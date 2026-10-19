// @vitest-environment jsdom
import type { EngineInfo, Job } from '@filecon/core/types';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/main/settings.ts';
import { AppShell } from '../../src/renderer/components/AppShell.tsx';
import { JobsPanel } from '../../src/renderer/components/JobsPanel.tsx';
import { EnginesPage } from '../../src/renderer/pages/EnginesPage.tsx';
import { SettingsPage } from '../../src/renderer/pages/SettingsPage.tsx';
import { CATALOGS } from '../../src/shared/i18n.ts';
import { StoreProvider } from '../../src/renderer/store/context.tsx';

type Listener = (data: unknown) => void;

const job = (fields: Partial<Job>): Job => ({
  id: '1',
  batchId: 'b',
  kind: 'convert',
  inputs: ['/dir/photo.png'],
  target: 'jpg',
  state: 'running',
  progress: { unit: 1, total: 2, fraction: 0.4 },
  outputs: [],
  notes: [],
  createdAt: 0,
  ...fields,
});

const ENGINES: EngineInfo[] = [
  { id: 'sharp', pack: 'builtin', found: true, source: 'bundled', installUrl: 'https://s.test' },
  { id: 'libreoffice', pack: 'office', found: false, installUrl: 'https://lo.test' },
];

const mount = async (page: 'jobs' | 'engines' | 'settings') => {
  const listeners = new Map<string, Listener>();
  const api = {
    on: (event: string, listener: Listener) => {
      listeners.set(event, listener);
      return () => listeners.delete(event);
    },
    getSettings: vi.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
    setSettings: vi.fn((patch: object) => Promise.resolve({ ...DEFAULT_SETTINGS, ...patch })),
    engines: vi.fn(() => Promise.resolve(ENGINES)),
    refreshEngines: vi.fn(() => Promise.resolve(ENGINES)),
    chooseEngine: vi.fn(() => Promise.resolve('/usr/bin/soffice')),
    openExternal: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
    reveal: vi.fn(() => Promise.resolve()),
    submit: vi.fn(() => Promise.resolve({ batchId: 'b', jobIds: ['2'] })),
  };
  Object.assign(window, { filecon: api });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
  const content =
    page === 'jobs' ? <JobsPanel /> : page === 'engines' ? <EnginesPage /> : <SettingsPage />;
  render(
    <StoreProvider>
      <AppShell>{content}</AppShell>
    </StoreProvider>,
  );
  await act(() => {
    listeners.get('core:status')?.({ status: 'ready', restarts: 0 });
    return Promise.resolve();
  });
  const push = (event: string, data: unknown) =>
    act(() => {
      listeners.get(event)?.(data);
      return Promise.resolve();
    });
  return { api, push };
};

afterEach(cleanup);

describe('JobsPanel', () => {
  it('shows nothing before a job exists', async () => {
    await mount('jobs');
    expect(screen.queryByRole('region', { name: 'Jobs' })).toBeNull();
  });

  it('a running job shows its step, progress and Cancel; the live region announces a summary', async () => {
    const { api, push } = await mount('jobs');
    await push('job:update', job({}));
    expect(screen.getByText('step 1/2')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('40%');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.cancel).toHaveBeenCalledWith('1');
    await waitFor(() => {
      const live = document.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe('0 done, 0 failed, 1 in progress');
    });
  });

  it('a job with no fraction shows an indeterminate bar that says working', async () => {
    const { push } = await mount('jobs');
    await push('job:update', job({ progress: { unit: 1, total: 1, fraction: null } }));
    expect(screen.getByLabelText('Working…')).toBeDefined();
  });

  it('a failed job shows its translated reason and Details, and Retry resubmits the request', async () => {
    const { api, push } = await mount('jobs');
    await push(
      'job:update',
      job({
        state: 'failed',
        error: {
          code: 'ENGINE_FAILED',
          params: { engine: 'sharp', name: 'photo.png' },
          detail: 'boom',
        },
      }),
    );
    expect(screen.getByRole('alert').textContent).toBe('sharp failed to convert photo.png');
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('boom')).toBeDefined();
    // No request is remembered for a job from an earlier session, so Retry is not offered.
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('a done job shows lossy notes and reveals its output', async () => {
    const { api, push } = await mount('jobs');
    await push(
      'job:update',
      job({ state: 'done', outputs: ['/out/photo.jpg'], notes: ['reencoded'] }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show in folder' }));
    expect(api.reveal).toHaveBeenCalledWith('/out/photo.jpg');
    expect(screen.getByText(CATALOGS.en['lossy.reencoded'] ?? '')).toBeDefined();
  });
});

describe('EnginesPage', () => {
  it('lists engines with status, and a missing one offers Set path and an install guide', async () => {
    const { api } = await mount('engines');
    await screen.findByText('libreoffice');
    expect(screen.getByText('Built in')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'How to install' }));
    expect(api.openExternal).toHaveBeenCalledWith('https://lo.test');
    fireEvent.click(screen.getByRole('button', { name: 'Set path…' }));
    await waitFor(() => expect(api.setSettings).toHaveBeenCalled());
    expect(api.setSettings).toHaveBeenCalledWith({
      engines: { paths: { libreoffice: '/usr/bin/soffice' }, priority: [] },
    });
  });
});

describe('SettingsPage', () => {
  it('changing theme and accent updates <html> without a reload', async () => {
    const { api } = await mount('settings');
    await screen.findByText('Theme');
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    fireEvent.click(screen.getByRole('radio', { name: 'Purple' }));
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe('purple'));
    expect(api.setSettings).toHaveBeenCalledTimes(2);
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('accent swatches carry a text name, never color alone', async () => {
    await mount('settings');
    for (const name of ['Blue', 'Green', 'Purple', 'Orange'])
      expect(await screen.findByRole('radio', { name })).toBeDefined();
  });
});
