import { describe, expect, it, vi } from 'vitest';

const exposeInMainWorld = vi.fn<(name: string, api: unknown) => void>();
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: {
    invoke: vi.fn<() => unknown>(),
    on: vi.fn<() => void>(),
    removeListener: vi.fn<() => void>(),
  },
  webUtils: { getPathForFile: vi.fn<() => string>() },
}));

describe('preload', () => {
  it('exposes window.filecon and nothing else', async () => {
    await import('../../src/preload/index.ts');
    expect(exposeInMainWorld).toHaveBeenCalledOnce();
    expect(exposeInMainWorld.mock.calls[0]?.[0]).toBe('filecon');
  });
});
