// @vitest-environment jsdom
import type { EngineInfo } from '@filecon/core/types';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/main/settings.ts';
import { AppShell } from '../../src/renderer/components/AppShell.tsx';
import { EnginesPage } from '../../src/renderer/pages/EnginesPage.tsx';
import { SettingsPage } from '../../src/renderer/pages/SettingsPage.tsx';
import { StoreProvider } from '../../src/renderer/store/context.tsx';

type Listener = (data: unknown) => void;

const ENGINES: EngineInfo[] = [
  { id: 'sharp', pack: 'builtin', found: true, source: 'bundled', installUrl: 'https://s.test' },
  { id: 'libreoffice', pack: 'office', found: false, installUrl: 'https://lo.test' },
];

const mount = async (page: 'engines' | 'settings', engines: EngineInfo[] = ENGINES) => {
  const listeners = new Map<string, Listener>();
  const api = {
    on: (event: string, listener: Listener) => {
      listeners.set(event, listener);
      return () => listeners.delete(event);
    },
    coreStatus: vi.fn(() => Promise.resolve({ status: 'starting', restarts: 0 })),
    getSettings: vi.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
    setSettings: vi.fn((patch: object) => Promise.resolve({ ...DEFAULT_SETTINGS, ...patch })),
    engines: vi.fn(() => Promise.resolve(engines)),
    refreshEngines: vi.fn(() => Promise.resolve(engines)),
    chooseEngine: vi.fn(() => Promise.resolve('/usr/bin/soffice')),
    chooseDir: vi.fn(() => Promise.resolve('/home/user/out')),
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
  const content = page === 'engines' ? <EnginesPage /> : <SettingsPage />;
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

  it('an invalid engine path shows its translated error', async () => {
    await mount('engines', [
      {
        id: 'libreoffice',
        pack: 'office',
        found: false,
        installUrl: 'https://lo.test',
        error: { code: 'override-not-executable', params: { path: '/tmp/nope' } },
      },
    ]);
    expect(
      await screen.findByText('The path you set is not an executable file: /tmp/nope'),
    ).toBeDefined();
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

  it('choosing an output folder saves it as the custom output', async () => {
    const { api } = await mount('settings');
    fireEvent.click(await screen.findByRole('radio', { name: 'Choose a folder…' }));
    await waitFor(() =>
      expect(api.setSettings).toHaveBeenCalledWith({
        output: { mode: 'custom', dir: '/home/user/out' },
      }),
    );
  });
});
