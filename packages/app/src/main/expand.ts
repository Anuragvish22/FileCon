import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { checkPath } from './paths.ts';

// CONTRACTS section 7, files:expand
const MAX_FILES = 1000;

export interface ExpandResult {
  files: string[];
  skipped: number;
  capped: boolean;
}

/**
 * Directories expand recursively, skipping hidden entries and symlinked directories. Paths that fail
 * validation count as skipped. Entries are sorted, so the same folder always gives the same order.
 */
export const expandPaths = async (values: unknown): Promise<ExpandResult> => {
  const result: ExpandResult = { files: [], skipped: 0, capped: false };
  if (!Array.isArray(values)) return result;

  const seen = new Set<string>(); // a folder and a file inside it can be dropped together
  const add = (file: string): boolean => {
    if (seen.has(file)) return true;
    if (result.files.length >= MAX_FILES) {
      result.capped = true;
      return false;
    }
    seen.add(file);
    result.files.push(file);
    return true;
  };

  const walk = async (directory: string): Promise<boolean> => {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => undefined);
    if (entries === undefined) {
      result.skipped += 1;
      return true;
    }
    entries.sort((first, second) => first.name.localeCompare(second.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      // A symlink is judged by what it points at: a linked file counts, a linked directory is skipped.
      const target = entry.isSymbolicLink() ? await stat(path).catch(() => undefined) : entry;
      if (
        entry.name.startsWith('.') ||
        target === undefined ||
        (entry.isSymbolicLink() && target.isDirectory())
      ) {
        result.skipped += 1;
        continue;
      }
      const keepGoing = target.isDirectory()
        ? await walk(path)
        : target.isFile()
          ? add(path)
          : true;
      if (!keepGoing) return false;
    }
    return true;
  };

  for (const value of values) {
    const checked = await checkPath(value, 'either');
    if (!checked.ok) {
      result.skipped += 1;
      continue;
    }
    const isDirectory = (await stat(checked.path)).isDirectory();
    if (!(isDirectory ? await walk(checked.path) : add(checked.path))) break;
  }
  return result;
};
