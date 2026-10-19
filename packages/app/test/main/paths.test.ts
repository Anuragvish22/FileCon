import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkPath } from '../../src/main/paths.ts';

let root = '';
let file = '';
let dir = '';

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'filecon-paths-'));
  file = join(root, 'a.png');
  dir = join(root, 'sub');
  await writeFile(file, 'x');
  await mkdir(dir);
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe('checkPath', () => {
  it('accepts an absolute file path', async () => {
    expect(await checkPath(file, 'file')).toEqual({ ok: true, path: file });
  });

  it('accepts a directory when one is wanted, and either kind', async () => {
    expect(await checkPath(dir, 'directory')).toEqual({ ok: true, path: dir });
    expect(await checkPath(file, 'either')).toMatchObject({ ok: true });
    expect(await checkPath(dir, 'either')).toMatchObject({ ok: true });
  });

  it('returns the resolved path of a symlink', async () => {
    const link = join(root, 'link.png');
    await symlink(file, link);
    expect(await checkPath(link, 'file')).toEqual({ ok: true, path: file });
  });

  it('refuses a relative path, a path with .. segments, and non-strings', async () => {
    const dotted = `${dir}/../a.png`; // would resolve to a real file, so only the rule can refuse it
    for (const bad of ['a.png', './a.png', dotted, 42, null, undefined, {}, ['x']]) {
      expect(await checkPath(bad, 'file')).toMatchObject({
        ok: false,
        error: { code: 'INPUT_UNREADABLE' },
      });
    }
  });

  it('refuses a NUL byte and an over-long path', async () => {
    expect(await checkPath(`${file}\0.txt`, 'file')).toMatchObject({ ok: false });
    expect(await checkPath(`/${'a'.repeat(4096)}`, 'file')).toMatchObject({ ok: false });
  });

  it('gives INPUT_NOT_FOUND for a missing path, naming the file', async () => {
    expect(await checkPath(join(root, 'gone.png'), 'file')).toEqual({
      ok: false,
      error: {
        code: 'INPUT_NOT_FOUND',
        params: { name: 'gone.png' },
        input: join(root, 'gone.png'),
      },
    });
  });

  it('gives INPUT_UNREADABLE for the wrong kind', async () => {
    expect(await checkPath(dir, 'file')).toMatchObject({ error: { code: 'INPUT_UNREADABLE' } });
    expect(await checkPath(file, 'directory')).toMatchObject({
      error: { code: 'INPUT_UNREADABLE' },
    });
  });
});
