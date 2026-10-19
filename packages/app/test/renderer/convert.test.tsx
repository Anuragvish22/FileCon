// @vitest-environment jsdom
import type { DetectResult, TargetsResult } from '@filecon/core/types';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/main/settings.ts';
import { AppShell } from '../../src/renderer/components/AppShell.tsx';
import { ConvertPage } from '../../src/renderer/pages/ConvertPage.tsx';
import { StoreProvider } from '../../src/renderer/store/context.tsx';

const TARGETS: TargetsResult = {
  convert: [
    {
      format: 'jpg',
      status: 'ready',
      lossy: ['reencoded'],
      fanOut: false,
      options: ['quality', 'background'],
    },
    { format: 'pdf', status: 'ready', lossy: [], fanOut: false, options: ['pageSize'] },
    {
      format: 'tiff',
      status: 'needs-pack',
      pack: 'imaging',
      lossy: [],
      fanOut: false,
      options: [],
    },
  ],
  merge: [{ combinerId: 'merge-pdf', output: 'pdf', status: 'ready', fanOut: false }],
  extract: [],
};

const detected = (path: string): DetectResult => ({
  path,
  size: 10,
  format: 'png',
  byContent: 'png',
  byExt: 'png',
  mismatch: false,
});

type Listener = (data: unknown) => void;

const mount = async (paths: string[]) => {
  const listeners = new Map<string, Listener>();
  const api = {
    on: (event: string, listener: Listener) => {
      listeners.set(event, listener);
      return () => listeners.delete(event);
    },
    getSettings: vi.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
    engines: vi.fn(() => Promise.resolve([])),
    openFiles: vi.fn(() => Promise.resolve(paths)),
    expand: vi.fn((given: string[]) =>
      Promise.resolve({ files: given, skipped: 0, capped: false }),
    ),
    detect: vi.fn((given: string[]) => Promise.resolve(given.map(detected))),
    targets: vi.fn(() => Promise.resolve(TARGETS)),
    submit: vi.fn(() => Promise.resolve({ batchId: 'b', jobIds: [] })),
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
  await act(() => {
    listeners.get('core:status')?.({ status: 'ready', restarts: 0 });
    return Promise.resolve();
  });
  return api;
};

// The nav tab is also called Convert, so pick the action button by its class.
const convertButton = (): HTMLButtonElement => {
  const button = document.querySelector<HTMLButtonElement>('button.primary');
  if (button === null) throw new Error('no Convert button');
  return button;
};

const loadFiles = async (api: Awaited<ReturnType<typeof mount>>) => {
  fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
  await waitFor(() => expect(api.detect).toHaveBeenCalled());
  await screen.findByRole('listbox', {}, { timeout: 2000 });
};

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
});
afterEach(cleanup);

describe('Convert page', () => {
  it('empty state: only the drop zone, no files, no targets, Convert disabled', async () => {
    await mount([]);
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeDefined();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(convertButton().disabled).toBe(true);
  });

  it('TargetPicker: arrows move the active option, Enter selects, and Convert is enabled', async () => {
    const api = await mount(['/a.png']);
    await loadFiles(api);
    const list = screen.getByRole('listbox');
    expect(list.getAttribute('aria-activedescendant')).toBe('target-jpg');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toBe('target-pdf');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(list.getAttribute('aria-activedescendant')).toBe('target-jpg');
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(screen.getByRole('option', { name: /JPEG/ }).getAttribute('aria-selected')).toBe('true');
    expect(convertButton().disabled).toBe(false);
    expect(screen.getByText('Background for transparency')).toBeDefined();
  });

  it('typeahead jumps to the option that starts with the typed letter', async () => {
    const api = await mount(['/a.png']);
    await loadFiles(api);
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'T' });
    expect(list.getAttribute('aria-activedescendant')).toBe('target-tiff');
  });

  it('a locked target cannot be submitted: choosing it opens Engines and Convert stays disabled', async () => {
    const api = await mount(['/a.png']);
    await loadFiles(api);
    fireEvent.click(screen.getByRole('option', { name: /TIFF/ }));
    expect(screen.getByRole('option', { name: /TIFF/ }).getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(convertButton().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Engines' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('merge toggle shows for two files and a pdf target, not for one', async () => {
    const api = await mount(['/a.png', '/b.png']);
    await loadFiles(api);
    expect(screen.queryByText('Merge into one file')).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /PDF/ }));
    expect(screen.getByText('Merge into one file')).toBeDefined();
  });

  it('two pdfs offer pdf as a merge-only target and ticking it submits one merge request', async () => {
    const api = await mount(['/a.pdf', '/b.pdf']);
    api.targets.mockResolvedValue({
      convert: [],
      merge: [{ combinerId: 'merge-pdf', output: 'pdf', status: 'ready', fanOut: false }],
      extract: [],
    });
    api.detect.mockImplementation((given: string[]) =>
      Promise.resolve(
        given.map((path) => ({ ...detected(path), format: 'pdf', byContent: 'pdf', byExt: 'pdf' })),
      ),
    );
    await loadFiles(api);
    fireEvent.click(screen.getByRole('option', { name: /PDF/ }));
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Merge into one file' }).checked,
    ).toBe(true);
    fireEvent.click(convertButton());
    await waitFor(() => expect(api.submit).toHaveBeenCalled());
    expect(api.submit).toHaveBeenCalledWith([
      { kind: 'merge', inputs: ['/a.pdf', '/b.pdf'], combinerId: 'merge-pdf', options: {} },
    ]);
  });

  it('submits one convert request per file', async () => {
    const api = await mount(['/a.png', '/b.png']);
    await loadFiles(api);
    fireEvent.click(screen.getByRole('option', { name: /JPEG/ }));
    fireEvent.click(convertButton());
    await waitFor(() => expect(api.submit).toHaveBeenCalled());
    expect(api.submit).toHaveBeenCalledWith([
      { kind: 'convert', input: '/a.png', target: 'jpg', options: {} },
      { kind: 'convert', input: '/b.png', target: 'jpg', options: {} },
    ]);
  });

  it('Alt+ArrowDown moves a file down the list', async () => {
    const api = await mount(['/a.png', '/b.png']);
    await loadFiles(api);
    const rows = () => screen.getAllByRole('listitem').map((row) => row.textContent);
    expect(rows()[0]).toContain('a.png');
    fireEvent.keyDown(screen.getAllByRole('listitem')[0] as HTMLElement, {
      key: 'ArrowDown',
      altKey: true,
    });
    expect(rows()[0]).toContain('b.png');
  });
});
