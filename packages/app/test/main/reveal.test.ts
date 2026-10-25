import { describe, expect, it, vi } from 'vitest';
import { createReveal, type RevealDeps } from '../../src/main/reveal.ts';

const deps = (fields: Partial<RevealDeps>): RevealDeps => ({
  platform: 'linux',
  wslDistro: undefined,
  shell: {
    showItemInFolder: vi.fn<(path: string) => void>(),
    openPath: vi.fn<(path: string) => Promise<string>>(() => Promise.resolve('')),
  },
  runWindowsProgram: vi.fn<(program: string, args: string[]) => void>(),
  ...fields,
});

describe('createReveal', () => {
  it('on Linux opens the file’s own folder once, never the app folder (xdg-open fallback)', () => {
    const given = deps({});
    createReveal(given)('/home/me/test-assets/a.avif');
    expect(given.shell.openPath).toHaveBeenCalledExactlyOnceWith('/home/me/test-assets');
    expect(given.shell.showItemInFolder).not.toHaveBeenCalled();
    expect(given.runWindowsProgram).not.toHaveBeenCalled();
  });

  it('in WSL opens the file’s folder in Windows Explorer, once, as a wsl.localhost path', () => {
    const given = deps({ wslDistro: 'Ubuntu' });
    createReveal(given)('/home/me/test assets/a.avif');
    expect(given.runWindowsProgram).toHaveBeenCalledExactlyOnceWith('explorer.exe', [
      '\\\\wsl.localhost\\Ubuntu\\home\\me\\test assets',
    ]);
    expect(given.shell.openPath).not.toHaveBeenCalled();
    expect(given.shell.showItemInFolder).not.toHaveBeenCalled();
  });

  it.each(['win32', 'darwin'] as const)('on %s selects the file in its folder', (platform) => {
    const given = deps({ platform, wslDistro: 'Ubuntu' });
    createReveal(given)('/x/a.avif');
    expect(given.shell.showItemInFolder).toHaveBeenCalledExactlyOnceWith('/x/a.avif');
    expect(given.shell.openPath).not.toHaveBeenCalled();
    expect(given.runWindowsProgram).not.toHaveBeenCalled();
  });
});
