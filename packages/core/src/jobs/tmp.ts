import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ARCHITECTURE section 9. The prefix is also what `sweep` uses to find our own dirs.
const JOB_DIR_PREFIX = 'filecon-';

export const makeJobDir = (jobId: string): Promise<string> =>
  mkdtemp(join(tmpdir(), `${JOB_DIR_PREFIX}${jobId}-`));

export const removeDir = (dirPath: string): Promise<void> =>
  // Retries because Windows can hold a handle on a just-closed file for a moment (EBUSY).
  rm(dirPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

/** Removes job dirs a dead host left behind. `root` is only for tests. */
export const sweep = async (olderThanMs: number, root = tmpdir()): Promise<void> => {
  const cutoff = Date.now() - olderThanMs;
  for (const name of await readdir(root)) {
    if (!name.startsWith(JOB_DIR_PREFIX)) continue;
    const dirPath = join(root, name);
    try {
      const stats = await stat(dirPath);
      if (stats.isDirectory() && stats.mtimeMs < cutoff) await removeDir(dirPath);
    } catch {
      // Gone already, or owned by someone else: not ours to clean.
    }
  }
};
