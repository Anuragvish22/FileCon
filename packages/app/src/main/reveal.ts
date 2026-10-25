import { execFile } from 'node:child_process';
// posix on purpose: the path is a Linux path, and the default `node:path` follows the host OS (tests run on Windows too)
import { dirname, sep } from 'node:path/posix';

export interface RevealShell {
  showItemInFolder: (path: string) => void;
  openPath: (path: string) => Promise<string>;
}

export interface RevealDeps {
  platform: NodeJS.Platform;
  /** `WSL_DISTRO_NAME` is set inside WSL, which has Windows Explorer but no Linux file manager. */
  wslDistro: string | undefined;
  shell: RevealShell;
  /** Starts a Windows program from WSL; Explorer exits 1 even on success, so the result is ignored. */
  runWindowsProgram: (program: string, args: string[]) => void;
}

export const runWindowsProgram = (program: string, args: string[]): void => {
  execFile(program, args, () => undefined);
};

/**
 * Chosen once at startup, so no later code asks which OS it runs on.
 * - Windows and macOS select the file in its folder.
 * - WSL opens the file's folder in Windows Explorer. Without a Linux file manager, xdg-open would
 *   hand the Linux path to Explorer, which opens Documents instead (twice, through $BROWSER).
 * - Other Linux opens the file's folder: Electron's showItemInFolder falls back to `xdg-open .`,
 *   which opens the app's own folder.
 */
export const createReveal = ({
  platform,
  wslDistro,
  shell,
  runWindowsProgram: run,
}: RevealDeps): ((path: string) => void) => {
  if (platform !== 'linux') return (path) => shell.showItemInFolder(path);
  if (wslDistro !== undefined && wslDistro !== '')
    return (path) =>
      run('explorer.exe', [
        `\\\\wsl.localhost\\${wslDistro}${dirname(path).split(sep).join('\\')}`,
      ]);
  return (path) => void shell.openPath(dirname(path));
};
