import { describe, expect, it, vi } from 'vitest';
import { lockNavigation, webPreferences, type NavigationTarget } from '../../src/main/window.ts';

describe('webPreferences', () => {
  it('isolates the renderer (hard rule 6)', () => {
    expect(webPreferences('/p/preload.js')).toEqual({
      preload: '/p/preload.js',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    });
  });
});

describe('lockNavigation', () => {
  it('cancels navigation and denies new windows', () => {
    const listeners: ((navigation: { preventDefault(): void }) => void)[] = [];
    const setWindowOpenHandler = vi.fn<NavigationTarget['setWindowOpenHandler']>();
    lockNavigation({ on: (_event, listener) => listeners.push(listener), setWindowOpenHandler });

    const preventDefault = vi.fn<() => void>();
    listeners[0]?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setWindowOpenHandler.mock.calls[0]?.[0]()).toEqual({ action: 'deny' });
  });
});
