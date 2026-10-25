// @vitest-environment jsdom
import type { DetectResult, Format, Job, TargetsResult } from '@filecon/core/types';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/main/settings.ts';
import { AppShell } from '../../src/renderer/components/AppShell.tsx';
import { ConvertPage } from '../../src/renderer/pages/ConvertPage.tsx';
import { StoreProvider } from '../../src/renderer/store/context.tsx';

const PNG_TARGETS: TargetsResult = {
  convert: [
    {
      format: 'jpg',
      status: 'ready',
      lossy: ['reencoded'],
      fanOut: false,
      options: ['quality', 'background'],
    },
    { format: 'pdf', status: 'ready', lossy: [], fanOut: false, options: ['pageSize'] },
    { format: 'tiff', status: 'needs-pack', pack: 'office', lossy: [], fanOut: false, options: [] },
  ],
  merge: [{ combinerId: 'merge-pdf', output: 'pdf', status: 'ready', fanOut: false }],
  extract: [],
};
const DOCX_TARGETS: TargetsResult = {
  convert: [
    { format: 'pdf', status: 'needs-pack', pack: 'office', lossy: [], fanOut: false, options: [] },
  ],
  merge: [],
  extract: [],
};
const MIXED_TARGETS: TargetsResult = { convert: [], merge: PNG_TARGETS.merge, extract: [] };

const FORMAT_OF_EXT: Record<string, Format | null> = { png: 'png', docx: 'docx', bin: null };

const detected = (path: string): DetectResult => {
  const format = FORMAT_OF_EXT[path.split('.').pop() ?? ''] ?? null;
  return {
    path,
    size: 2100,
    format,
    byContent: format,
    byExt: format,
    mismatch: path.includes('fake'),
  };
};

const job = (fields: Partial<Job>): Job => ({
  id: '1',
  batchId: 'b',
  kind: 'convert',
  inputs: ['/a.png'],
  target: 'jpg',
  state: 'running',
  progress: { unit: 1, total: 1, fraction: 0.4 },
  outputs: [],
  notes: [],
  createdAt: 0,
  ...fields,
});

type Listener = (data: unknown) => void;

const mount = async (paths: string[]) => {
  const listeners = new Map<string, Listener>();
  const api = {
    on: (event: string, listener: Listener) => {
      listeners.set(event, listener);
      return () => listeners.delete(event);
    },
    coreStatus: vi.fn(() => Promise.resolve({ status: 'starting', restarts: 0 })),
    getSettings: vi.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
    engines: vi.fn(() => Promise.resolve([])),
    openFiles: vi.fn(() => Promise.resolve(paths)),
    expand: vi.fn((given: string[]) =>
      Promise.resolve({ files: given, skipped: 0, capped: false }),
    ),
    detect: vi.fn((given: string[]) => Promise.resolve(given.map(detected))),
    targets: vi.fn((formats: string[]) =>
      Promise.resolve(
        formats.length > 1 ? MIXED_TARGETS : formats[0] === 'docx' ? DOCX_TARGETS : PNG_TARGETS,
      ),
    ),
    submit: vi.fn((requests: unknown[]) =>
      Promise.resolve({
        batchId: 'b',
        jobIds: [...requests.keys()].map((index) => String(index + 1)),
      }),
    ),
    cancel: vi.fn(() => Promise.resolve()),
    reveal: vi.fn(() => Promise.resolve()),
    pathForFile: vi.fn(() => ''),
  };
  Object.assign(window, { filecon: api });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
  render(
    <StoreProvider>
      <AppShell>
        <ConvertPage />
      </AppShell>
    </StoreProvider>,
  );
  const push = (event: string, data: unknown) =>
    act(() => {
      listeners.get(event)?.(data);
      return Promise.resolve();
    });
  await push('core:status', { status: 'ready', restarts: 0 });
  return { api, push };
};

type Harness = Awaited<ReturnType<typeof mount>>;

const loadFiles = async (harness: Harness, rows: number, asksTargets = true) => {
  fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
  await waitFor(() => expect(harness.api.detect).toHaveBeenCalled());
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(rows));
  if (asksTargets) {
    // The answer arrives after a short debounce; chips stay dimmed until then.
    await waitFor(() => expect(harness.api.targets).toHaveBeenCalled(), { timeout: 2000 });
    await act(() => Promise.resolve());
  }
};

const formatButton = (name: string) =>
  screen.getByRole('button', { name: `Choose format for ${name}` });

/** Opens a row's format popover, searches and presses Enter on the first match. */
const pick = async (name: string, query: string) => {
  fireEvent.click(formatButton(name));
  const box = await screen.findByRole('combobox');
  fireEvent.change(box, { target: { value: query } });
  fireEvent.keyDown(box, { key: 'Enter' });
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
};

const convertButton = () => screen.getByRole('button', { name: /^(Convert|Sending)/ });

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
});
afterEach(cleanup);

describe('Files page, state matrix columns', () => {
  it('empty: the drop zone only', async () => {
    await mount([]);
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Convert/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Files' }).getAttribute('aria-current')).toBe('page');
  });

  it('detecting: a spinner row, and Convert says it waits', async () => {
    const harness = await mount(['/a.png']);
    let finish: (results: DetectResult[]) => void = () => undefined;
    harness.api.detect.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
    await screen.findByText('Detecting…');
    expect(convertButton().getAttribute('aria-disabled')).toBe('true');
    expect(convertButton().textContent).toContain('Waiting for detection');
    await act(() => {
      finish([detected('/a.png')]);
      return Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByText('Detecting…')).toBeNull());
  });

  it('ready: type, arrow, select, options and remove on each row', async () => {
    const harness = await mount(['/a.png', '/b.png']);
    await loadFiles(harness, 2);
    expect(formatButton('a.png').textContent).toContain('Choose format');
    expect(screen.getByRole('button', { name: 'Options for a.png' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove a.png' })).toBeDefined();
    expect(convertButton().textContent).toContain('Convert 0');
    expect(convertButton().getAttribute('aria-disabled')).toBe('true');
  });

  it('unsupported: a reason instead of a select', async () => {
    const harness = await mount(['/x.bin']);
    await loadFiles(harness, 1, false);
    expect(screen.getByText('Format not supported')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Choose format/ })).toBeNull();
  });

  it('mismatch: the row says what was detected', async () => {
    const harness = await mount(['/fake.png']);
    await loadFiles(harness, 1);
    expect(screen.getByText(/content and the extension disagree/)).toBeDefined();
  });

  it('busy: Convert is aria-busy and the row controls are aria-disabled while submit runs', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    await pick('a.png', 'jpg');
    let finish: (value: { batchId: string; jobIds: string[] }) => void = () => undefined;
    harness.api.submit.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    fireEvent.click(convertButton());
    await waitFor(() => expect(convertButton().getAttribute('aria-busy')).toBe('true'));
    expect(formatButton('a.png').getAttribute('aria-disabled')).toBe('true');
    await act(() => {
      finish({ batchId: 'b', jobIds: ['1'] });
      return Promise.resolve();
    });
  });

  it('core unavailable: Convert says why', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    await harness.push('core:status', { status: 'unavailable', restarts: 3 });
    expect(convertButton().getAttribute('aria-disabled')).toBe('true');
    expect(convertButton().textContent).toContain('Converter unavailable');
    expect(formatButton('a.png').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Files page, converting', () => {
  it('drop 3 files, pick a format on each, Convert: progress, then done with Show in folder', async () => {
    const harness = await mount(['/a.png', '/b.png', '/c.png']);
    await loadFiles(harness, 3);
    for (const name of ['a.png', 'b.png', 'c.png']) await pick(name, 'jpg');
    expect(convertButton().textContent).toContain('Convert 3');
    fireEvent.click(convertButton());
    await waitFor(() => expect(harness.api.submit).toHaveBeenCalled());
    expect(harness.api.submit).toHaveBeenCalledWith([
      { kind: 'convert', input: '/a.png', target: 'jpg', options: {} },
      { kind: 'convert', input: '/b.png', target: 'jpg', options: {} },
      { kind: 'convert', input: '/c.png', target: 'jpg', options: {} },
    ]);

    await harness.push('job:update', job({ id: '1', inputs: ['/a.png'] }));
    const first = screen.getAllByRole('listitem')[0] as HTMLElement;
    expect(within(first).getByRole('progressbar').getAttribute('aria-label')).toContain('40%');
    expect(screen.getByText('1 running')).toBeDefined();
    fireEvent.click(within(first).getByRole('button', { name: 'Cancel' }));
    expect(harness.api.cancel).toHaveBeenCalledWith('1');

    await harness.push(
      'job:update',
      job({ id: '1', state: 'done', outputs: ['/out/a.jpg'], notes: ['reencoded'] }),
    );
    fireEvent.click(within(first).getByRole('button', { name: 'Show in folder' }));
    expect(harness.api.reveal).toHaveBeenCalledWith('/out/a.jpg');
    expect(within(first).getByText('a.jpg')).toBeDefined();
  });

  it('an indeterminate job says working', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    await pick('a.png', 'jpg');
    fireEvent.click(convertButton());
    await waitFor(() => expect(harness.api.submit).toHaveBeenCalled());
    await harness.push('job:update', job({ progress: { unit: 1, total: 1, fraction: null } }));
    expect(screen.getAllByText('Working…').length).toBeGreaterThan(0);
  });

  it('failed: the reason, Details and Retry; cancelled: Retry', async () => {
    const harness = await mount(['/a.png', '/b.png']);
    await loadFiles(harness, 2);
    await pick('a.png', 'jpg');
    await pick('b.png', 'jpg');
    fireEvent.click(convertButton());
    await waitFor(() => expect(harness.api.submit).toHaveBeenCalled());
    await harness.push(
      'job:update',
      job({
        state: 'failed',
        error: {
          code: 'ENGINE_FAILED',
          params: { engine: 'sharp', name: 'a.png' },
          detail: 'boom',
        },
      }),
    );
    await harness.push('job:update', job({ id: '2', inputs: ['/b.png'], state: 'cancelled' }));
    expect(screen.getByRole('alert').textContent).toBe('sharp failed to convert a.png');
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('boom')).toBeDefined();
    expect(screen.getByText('0 done · 1 failed · 1 cancelled')).toBeDefined();
    harness.api.submit.mockClear();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0] as HTMLElement);
    await waitFor(() => expect(harness.api.submit).toHaveBeenCalled());
    expect(harness.api.submit).toHaveBeenCalledWith([
      { kind: 'convert', input: '/a.png', target: 'jpg', options: {} },
    ]);
  });
});

describe('Files page, format popover', () => {
  it('lists every format; a format the file cannot become is aria-disabled, focusable, with its reason', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    fireEvent.click(formatButton('a.png'));
    const box = await screen.findByRole('combobox');
    fireEvent.change(box, { target: { value: 'svg' } });
    const chip = await screen.findByRole('option', { name: /SVG/ });
    expect(chip.getAttribute('aria-disabled')).toBe('true');
    expect(chip.hasAttribute('disabled')).toBe(false);
    const reason = document.getElementById(chip.getAttribute('aria-describedby') ?? '');
    expect(reason?.textContent).toBe("PNG can't be converted to SVG");
    fireEvent.click(chip);
    expect(screen.queryByRole('combobox')).not.toBeNull(); // picking it does nothing
  });

  it('keyboard: arrows move, Enter picks', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    fireEvent.click(formatButton('a.png'));
    const box = await screen.findByRole('combobox');
    fireEvent.change(box, { target: { value: 'p' } }); // JPG, PNG, PDF: available ones come first
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    const active = box.getAttribute('aria-activedescendant');
    expect(document.getElementById(active ?? '')?.getAttribute('role')).toBe('option');
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    expect(formatButton('a.png').textContent).not.toContain('Choose format');
  });

  it('a locked chip opens Engines and Convert stays off', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    fireEvent.click(formatButton('a.png'));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'tiff' } });
    fireEvent.click(await screen.findByRole('option', { name: /TIFF/ }));
    expect(screen.getByRole('button', { name: 'Engines' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(convertButton().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Files page, per-row and batch choices', () => {
  it('a jpg-bound png and a locked docx: each row keeps its own target, Convert all to fills the rest', async () => {
    const harness = await mount(['/a.png', '/b.docx']);
    await loadFiles(harness, 2);
    await pick('a.png', 'jpg');
    expect(formatButton('a.png').textContent).toContain('JPG');
    expect(formatButton('b.docx').textContent).toContain('Choose format');
    fireEvent.click(screen.getByRole('button', { name: 'Choose format for All files' }));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'pdf' } });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    expect(formatButton('a.png').textContent).toContain('PDF');
    expect(formatButton('b.docx').textContent).toContain('PDF'); // shown, but locked
    expect(screen.getByText('needs Office pack')).toBeDefined();
    expect(convertButton().textContent).toContain('Convert 1');
  });

  it('options: only the keys the route honours, Apply to all rows sets the others', async () => {
    const harness = await mount(['/a.png', '/b.png']);
    await loadFiles(harness, 2);
    await pick('a.png', 'jpg');
    await pick('b.png', 'jpg');
    expect(
      screen.getAllByRole('button', { name: /Options for/ })[0]?.getAttribute('aria-disabled'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Options for a.png' }));
    const dialog = await screen.findByRole('dialog', { name: 'Options for a.png' });
    expect(within(dialog).queryByLabelText('Page size')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Quality'), { target: { value: '50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply to all rows' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(convertButton());
    await waitFor(() => expect(harness.api.submit).toHaveBeenCalled());
    expect(harness.api.submit).toHaveBeenCalledWith([
      { kind: 'convert', input: '/a.png', target: 'jpg', options: { quality: 50 } },
      { kind: 'convert', input: '/b.png', target: 'jpg', options: { quality: 50 } },
    ]);
  });

  it('a row with no target has an options button that says there is nothing to set', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    const button = screen.getByRole('button', { name: 'Options for a.png' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(
      document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('No options for this conversion');
  });

  it('Alt+ArrowDown moves a file down the list', async () => {
    const harness = await mount(['/a.png', '/b.png']);
    await loadFiles(harness, 2);
    const rows = () => screen.getAllByRole('listitem').map((row) => row.textContent);
    expect(rows()[0]).toContain('a.png');
    fireEvent.keyDown(screen.getAllByRole('listitem')[0] as HTMLElement, {
      key: 'ArrowDown',
      altKey: true,
    });
    expect(rows()[0]).toContain('b.png');
  });
});

describe('Files page, merge group', () => {
  it('merge two rows, reorder, one bar with steps, then one result row', async () => {
    const harness = await mount(['/a.png', '/b.png', '/c.png']);
    await loadFiles(harness, 3);
    fireEvent.click(screen.getByRole('button', { name: /^Merge…/ }));
    await screen.findByRole('button', { name: 'Unmerge' });
    // Targets for the group are asked for its formats; PDF is the default output.
    await waitFor(() => expect(convertButton().textContent).toContain('Convert 1'));

    const members = within(screen.getAllByRole('list')[1] as HTMLElement).getAllByRole('listitem');
    fireEvent.keyDown(members[0] as HTMLElement, { key: 'ArrowDown', altKey: true });
    fireEvent.click(convertButton());
    await waitFor(() => expect(harness.api.submit).toHaveBeenCalled());
    expect(harness.api.submit).toHaveBeenCalledWith([
      {
        kind: 'merge',
        inputs: ['/b.png', '/a.png', '/c.png'],
        combinerId: 'merge-pdf',
        options: {},
      },
    ]);

    await harness.push(
      'job:update',
      job({
        kind: 'merge',
        inputs: ['/b.png', '/a.png', '/c.png'],
        target: 'pdf',
        progress: { unit: 2, total: 4, fraction: 0.5 },
      }),
    );
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByText('step 2/4')).toBeDefined();

    await harness.push(
      'job:update',
      job({
        kind: 'merge',
        inputs: ['/b.png', '/a.png', '/c.png'],
        target: 'pdf',
        state: 'done',
        outputs: ['/out/merged.pdf'],
      }),
    );
    expect(screen.getByText('merged.pdf')).toBeDefined();
    expect(screen.getByText('3 files')).toBeDefined();
    expect(screen.queryByText('c.png')).toBeNull(); // members collapse into the result row
  });

  it('the same file twice is two rows, and merging them sends its path twice (P59)', async () => {
    const harness = await mount(['/a.png', '/a.png']);
    await loadFiles(harness, 2);
    fireEvent.click(screen.getByRole('button', { name: /^Merge…/ }));
    await screen.findByRole('button', { name: 'Unmerge' });
    await waitFor(() => expect(convertButton().textContent).toContain('Convert 1'));
    fireEvent.click(convertButton());
    await waitFor(() => expect(harness.api.submit).toHaveBeenCalled());
    expect(harness.api.submit).toHaveBeenCalledWith([
      { kind: 'merge', inputs: ['/a.png', '/a.png'], combinerId: 'merge-pdf', options: {} },
    ]);
  });

  it('Unmerge returns the rows', async () => {
    const harness = await mount(['/a.png', '/b.png']);
    await loadFiles(harness, 2);
    fireEvent.click(screen.getByRole('button', { name: /^Merge…/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unmerge' }));
    expect(screen.queryByRole('button', { name: 'Unmerge' })).toBeNull();
    expect(formatButton('a.png')).toBeDefined();
  });

  it('Merge… is off with fewer than two rows', async () => {
    const harness = await mount(['/a.png']);
    await loadFiles(harness, 1);
    expect(screen.getByRole('button', { name: /^Merge…/ }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});
