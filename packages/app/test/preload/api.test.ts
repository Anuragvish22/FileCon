import { describe, expect, it, vi } from 'vitest';
import { createApi, type PreloadDeps } from '../../src/preload/api.ts';

const apiWith = (invoke: PreloadDeps['invoke']) =>
  createApi({ invoke, subscribe: () => () => undefined, pathForFile: () => '' });

describe('createApi', () => {
  it('unwraps a successful reply', async () => {
    const api = apiWith(() => Promise.resolve({ ok: true, value: ['a'] }));
    await expect(api.openFiles()).resolves.toEqual(['a']);
  });

  it('rejects with the plain CoreError of a failed reply', async () => {
    const error = { code: 'CANCELLED', params: {} };
    const api = apiWith(() => Promise.resolve({ ok: false, error }));
    await expect(api.installEngine('ffmpeg')).rejects.toBe(error);
  });

  it('sends each call on its channel with its payload', async () => {
    const invoke = vi.fn<PreloadDeps['invoke']>(() => Promise.resolve({ ok: true }));
    await apiWith(invoke).cancel('job-1');
    expect(invoke).toHaveBeenCalledWith('job:cancel', 'job-1');
  });

  it('subscribes only to push channels and returns the unsubscribe', () => {
    const unsubscribe = vi.fn<() => void>();
    const subscribe = vi.fn<PreloadDeps['subscribe']>(() => unsubscribe);
    const api = createApi({ invoke: () => Promise.resolve({}), subscribe, pathForFile: () => '' });
    api.on('core:status', () => undefined)();
    expect(unsubscribe).toHaveBeenCalledOnce();
    // @ts-expect-error a channel outside the push list must not reach ipcRenderer
    api.on('job:submit', () => undefined);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
