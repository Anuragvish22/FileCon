import { describe, expect, it, vi } from 'vitest';
import {
  lockNavigation,
  sendToWindow,
  webPreferences,
  type NavigationTarget,
  type PushTarget,
} from '../../src/main/window.ts';

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

describe('sendToWindow', () => {
  const windowWith = (state: { window: boolean; contents: boolean }) => {
    const send = vi.fn();
    const target: PushTarget = {
      isDestroyed: () => state.window,
      webContents: { isDestroyed: () => state.contents, send },
    };
    return { target, send };
  };

  it('sends to a live window', () => {
    const { target, send } = windowWith({ window: false, contents: false });
    sendToWindow(target, 'core:status', { status: 'ready' });
    expect(send).toHaveBeenCalledWith('core:status', { status: 'ready' });
  });

  it.each([
    ['no window yet', undefined],
    ['a destroyed window', windowWith({ window: true, contents: false }).target],
    ['destroyed contents', windowWith({ window: false, contents: true }).target],
  ])('does nothing for %s, so a push during quit cannot throw', (unused, target) => {
    expect(() => sendToWindow(target, 'jobs:update', {})).not.toThrow();
  });
});
