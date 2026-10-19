import { realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute } from 'node:path';
import type { CoreError } from '@filecon/core/types';

// CONTRACTS section 7, path validation in main.
const MAX_PATH_LENGTH = 4096;

export type PathKind = 'file' | 'directory' | 'either';

export type PathCheck = { ok: true; path: string } | { ok: false; error: CoreError };

const notFound = (path: string): PathCheck => ({
  ok: false,
  error: { code: 'INPUT_NOT_FOUND', params: { name: basename(path) }, input: path },
});

const unreadable = (path: string): PathCheck => ({
  ok: false,
  error: { code: 'INPUT_UNREADABLE', params: { name: basename(path) }, input: path },
});

/**
 * Checks one path from the renderer. The result carries the resolved path (symlinks followed), which is
 * what the rest of main and core use. A bad path fails alone: the caller never rejects its whole batch.
 */
export const checkPath = async (value: unknown, kind: PathKind): Promise<PathCheck> => {
  if (
    typeof value !== 'string' ||
    value.length > MAX_PATH_LENGTH ||
    value.includes('\0') ||
    !isAbsolute(value) ||
    value.split(/[\\/]/).includes('..')
  ) {
    return {
      ok: false,
      error: {
        code: 'INPUT_UNREADABLE',
        params: { name: '' },
        ...(typeof value === 'string' ? { input: value.slice(0, MAX_PATH_LENGTH) } : {}),
      },
    };
  }
  let resolved: string;
  try {
    resolved = await realpath(value);
  } catch (caught) {
    return (caught as NodeJS.ErrnoException).code === 'ENOENT'
      ? notFound(value)
      : unreadable(value);
  }
  const info = await stat(resolved).catch(() => undefined);
  if (info === undefined) return unreadable(value);
  const matches =
    kind === 'either'
      ? info.isFile() || info.isDirectory()
      : kind === 'file'
        ? info.isFile()
        : info.isDirectory();
  return matches ? { ok: true, path: resolved } : unreadable(value);
};
