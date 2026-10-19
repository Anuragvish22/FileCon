import { mkdir, mkdtemp, readdir, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeJobDir, removeDir, sweep } from '../../src/jobs/tmp.ts';

const HOUR_MS = 3_600_000;
const SWEEP_AGE_MS = 24 * HOUR_MS;

describe('makeJobDir and removeDir', () => {
  it('makes a private dir named after the job, and removes it with its content', async () => {
    const dirPath = await makeJobDir('job-1');
    expect(basename(dirPath)).toMatch(/^filecon-job-1-/);
    expect((await stat(dirPath)).isDirectory()).toBe(true);
    await mkdir(join(dirPath, 'step-0'));
    await removeDir(dirPath);
    await expect(stat(dirPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('gives two dirs of the same job different names', async () => {
    const [first, second] = await Promise.all([makeJobDir('same'), makeJobDir('same')]);
    expect(first).not.toBe(second);
    await Promise.all([removeDir(first), removeDir(second)]);
  });

  it('removing a dir that is already gone is not an error', async () => {
    await expect(removeDir(join(tmpdir(), 'filecon-never-made'))).resolves.toBeUndefined();
  });
});

describe('sweep', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'filecon-sweep-root-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const makeAged = async (name: string, ageMs: number): Promise<void> => {
    await mkdir(join(root, name));
    const then = new Date(Date.now() - ageMs);
    await utimes(join(root, name), then, then);
  };

  it('removes only old filecon-* dirs', async () => {
    await makeAged('filecon-old-1', SWEEP_AGE_MS + HOUR_MS);
    await makeAged('filecon-fresh-1', HOUR_MS);
    await makeAged('other-old', SWEEP_AGE_MS + HOUR_MS);
    await sweep(SWEEP_AGE_MS, root);
    expect((await readdir(root)).sort()).toEqual(['filecon-fresh-1', 'other-old']);
  });
});
