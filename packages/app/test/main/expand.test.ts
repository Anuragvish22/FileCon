import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expandPaths } from '../../src/main/expand.ts';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filecon-expand-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('expandPaths', () => {
  it('walks folders in name order and keeps a plain file as it is', async () => {
    await mkdir(join(dir, 'sub'));
    await writeFile(join(dir, 'b.png'), '');
    await writeFile(join(dir, 'a.png'), '');
    await writeFile(join(dir, 'sub', 'c.png'), '');
    await writeFile(join(dir, 'lone.pdf'), '');
    const result = await expandPaths([dir, join(dir, 'lone.pdf')]);
    expect(result).toEqual({
      files: ['a.png', 'b.png', 'lone.pdf', join('sub', 'c.png')].map((name) => join(dir, name)),
      skipped: 0,
      capped: false,
    });
  });

  it('skips hidden entries, linked folders and bad paths, but follows a linked file', async () => {
    await mkdir(join(dir, 'real'));
    await writeFile(join(dir, 'real', 'inside.png'), '');
    await writeFile(join(dir, '.hidden.png'), '');
    await writeFile(join(dir, 'file.png'), '');
    await symlink(join(dir, 'real'), join(dir, 'linked-dir'));
    await symlink(join(dir, 'file.png'), join(dir, 'linked-file.png'));
    const result = await expandPaths([dir, 'relative/path', join(dir, 'missing')]);
    expect(result.files.map((file) => file.slice(dir.length + 1))).toEqual([
      'file.png',
      'linked-file.png',
      join('real', 'inside.png'),
    ]);
    expect(result.skipped).toBe(4); // .hidden.png, linked-dir, relative path, missing
  });

  it('stops at 1000 files and says so', async () => {
    const MANY = 1005;
    await Promise.all(
      Array.from({ length: MANY }, (unused, index) => writeFile(join(dir, `f${index}.png`), '')),
    );
    const result = await expandPaths([dir]);
    expect(result.files).toHaveLength(1000);
    expect(result.capped).toBe(true);
  });

  it('gives nothing for a payload that is not a list', async () => {
    expect(await expandPaths('nope')).toEqual({ files: [], skipped: 0, capped: false });
  });
});
