import * as realFs from 'node:fs/promises';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CoreFailure } from '../../src/errors.ts';
import { commitFile, commitFolder, safeStem, type FsOps } from '../../src/jobs/output.ts';

const BIG_BOOK_PAGES = 1800;
const MAX_STEM_BYTES = 200;

let root: string;
let outDir: string;
let tempDir: string;
let counter = 0;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'filecon-output-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
beforeEach(async () => {
  counter += 1;
  outDir = join(root, `out-${counter}`);
  tempDir = join(root, `temp-${counter}`);
  await mkdir(outDir);
  await mkdir(tempDir);
});

const makeTemp = async (name: string, content = name): Promise<string> => {
  const path = join(tempDir, name);
  await writeFile(path, content);
  return path;
};

const errno = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code });

const failing = (overrides: Partial<FsOps>): FsOps => ({ ...realFs, ...overrides });

const failureOf = async (action: Promise<unknown>): Promise<CoreFailure> => {
  const caught: unknown = await action.then(
    () => undefined,
    (cause: unknown) => cause,
  );
  expect(caught).toBeInstanceOf(CoreFailure);
  return caught as CoreFailure;
};

describe('commitFile: happy path', () => {
  it('saves under the plain name when there is no conflict, and removes the temp file', async () => {
    const src = await makeTemp('out.png', 'new');
    const committed = await commitFile({ src, dir: outDir, stem: 'photo', ext: 'png' });
    expect(committed).toBe(join(outDir, 'photo.png'));
    expect(await readFile(committed, 'utf8')).toBe('new');
    await expect(stat(src)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('numbers the name on conflict and never touches the existing file', async () => {
    await writeFile(join(outDir, 'photo.png'), 'mine');
    const names: string[] = [];
    for (const content of ['one', 'two']) {
      const src = await makeTemp(`${content}.png`, content);
      names.push(await commitFile({ src, dir: outDir, stem: 'photo', ext: 'png' }));
    }
    expect(names).toEqual([join(outDir, 'photo (1).png'), join(outDir, 'photo (2).png')]);
    expect(await readFile(join(outDir, 'photo.png'), 'utf8')).toBe('mine');
  });
});

describe('commitFile: must also pass', () => {
  it('two concurrent commits of the same stem get distinct names', async () => {
    const sources = await Promise.all(
      Array.from({ length: 8 }, (_slot, index) => makeTemp(`c${index}.png`, `content-${index}`)),
    );
    const committed = await Promise.all(
      sources.map((src) => commitFile({ src, dir: outDir, stem: 'same', ext: 'png' })),
    );
    expect(new Set(committed).size).toBe(sources.length);
    const contents = await Promise.all(committed.map((path) => readFile(path, 'utf8')));
    expect(new Set(contents).size).toBe(sources.length);
  });

  it('a source that is already in the output dir is never the destination', async () => {
    const original = join(outDir, 'a.png');
    await writeFile(original, 'really a jpeg');
    const before = await stat(original);
    const src = await makeTemp('converted.png', 'converted');
    const committed = await commitFile({ src, dir: outDir, stem: 'a', ext: 'png' });
    expect(committed).toBe(join(outDir, 'a (1).png'));
    const after = await stat(original);
    expect(await readFile(original, 'utf8')).toBe('really a jpeg');
    expect([after.size, after.mtimeMs]).toEqual([before.size, before.mtimeMs]);
  });

  it('copies when the output is on another device (EXDEV)', async () => {
    const src = await makeTemp('x.png', 'across');
    const fsOps = failing({
      link: (existing, target) =>
        existing === src ? Promise.reject(errno('EXDEV')) : realFs.link(existing, target),
    });
    const committed = await commitFile({ src, dir: outDir, stem: 'far', ext: 'png', fsOps });
    expect(await readFile(committed, 'utf8')).toBe('across');
    expect(await readdir(outDir)).toEqual(['far.png']);
  });

  it('copies and renames when hard links are not supported at all (FAT)', async () => {
    const src = await makeTemp('x.png', 'fat');
    const fsOps = failing({ link: () => Promise.reject(errno('EPERM')) });
    const committed = await commitFile({ src, dir: outDir, stem: 'usb', ext: 'png', fsOps });
    expect(await readFile(committed, 'utf8')).toBe('fat');
    expect(await readdir(outDir)).toEqual(['usb.png']);
    await expect(stat(src)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('the no-link fallback still never replaces an existing file', async () => {
    await writeFile(join(outDir, 'usb.png'), 'mine');
    const src = await makeTemp('x.png', 'fat');
    const fsOps = failing({ link: () => Promise.reject(errno('EPERM')) });
    const committed = await commitFile({ src, dir: outDir, stem: 'usb', ext: 'png', fsOps });
    expect(committed).toBe(join(outDir, 'usb (1).png'));
    expect(await readFile(join(outDir, 'usb.png'), 'utf8')).toBe('mine');
  });

  it('a full disk is DISK_FULL, and no part file is left', async () => {
    const src = await makeTemp('x.png');
    const fsOps = failing({
      link: () => Promise.reject(errno('EXDEV')),
      copyFile: () => Promise.reject(errno('ENOSPC')),
    });
    const failure = await failureOf(
      commitFile({ src, dir: outDir, stem: 'big', ext: 'png', fsOps }),
    );
    expect(failure.error.code).toBe('DISK_FULL');
    expect(await readdir(outDir)).toEqual([]);
    expect((await stat(src)).isFile()).toBe(true);
  });

  it('any other write failure is OUTPUT_WRITE_FAILED with the cause as detail', async () => {
    const src = await makeTemp('x.png');
    const fsOps = failing({ link: () => Promise.reject(errno('EACCES')) });
    const failure = await failureOf(
      commitFile({ src, dir: outDir, stem: 'no', ext: 'png', fsOps }),
    );
    expect(failure.error).toMatchObject({
      code: 'OUTPUT_WRITE_FAILED',
      params: { name: 'no.png' },
    });
    expect(failure.error.detail).toBe('EACCES');
  });

  it('gives up after 999 numbered names with OUTPUT_WRITE_FAILED', async () => {
    const src = await makeTemp('x.png');
    const fsOps = failing({ link: () => Promise.reject(errno('EEXIST')) });
    const failure = await failureOf(
      commitFile({ src, dir: outDir, stem: 'busy', ext: 'png', fsOps }),
    );
    expect(failure.error.code).toBe('OUTPUT_WRITE_FAILED');
  });

  it('tries exactly names (1) to (999) before giving up', async () => {
    const tried: string[] = [];
    const src = await makeTemp('x.png');
    const fsOps = failing({
      link: (_existing, target) => {
        tried.push(String(target));
        return Promise.reject(errno('EEXIST'));
      },
    });
    await failureOf(commitFile({ src, dir: outDir, stem: 'busy', ext: 'png', fsOps }));
    expect(tried[0]).toBe(join(outDir, 'busy.png'));
    expect(tried.at(-1)).toBe(join(outDir, 'busy (999).png'));
  });

  it('frees its name reservation after success and after failure', async () => {
    const first = await makeTemp('a.png');
    await commitFile({ src: first, dir: outDir, stem: 'reuse', ext: 'png' });
    await rm(join(outDir, 'reuse.png'));
    const second = await makeTemp('b.png');
    expect(await commitFile({ src: second, dir: outDir, stem: 'reuse', ext: 'png' })).toBe(
      join(outDir, 'reuse.png'),
    );
    const third = await makeTemp('c.png');
    await failureOf(
      commitFile({
        src: third,
        dir: outDir,
        stem: 'gone',
        ext: 'png',
        fsOps: failing({ link: () => Promise.reject(errno('EACCES')) }),
      }),
    );
    expect(await commitFile({ src: third, dir: outDir, stem: 'gone', ext: 'png' })).toBe(
      join(outDir, 'gone.png'),
    );
  });

  it('cleans an unsafe stem, so a name can never leave the output dir', async () => {
    const src = await makeTemp('x.png');
    const committed = await commitFile({ src, dir: outDir, stem: '../evil', ext: 'png' });
    expect(committed).toBe(join(outDir, '.._evil.png'));
  });
});

describe('safeStem', () => {
  it('replaces characters FAT and Windows reject', () => {
    expect(safeStem('a:b?')).toBe('a_b_');
    expect(safeStem('x<y>z"w/v\\u|t*s')).toBe('x_y_z_w_v_u_t_s');
    expect(safeStem('tab\there')).toBe('tab_here');
  });

  it('trims trailing dots and spaces', () => {
    expect(safeStem('report. . ')).toBe('report');
  });

  it('marks Windows reserved names, with or without an extension, in any case', () => {
    expect(safeStem('CON')).toBe('CON_');
    expect(safeStem('con.txt')).toBe('con.txt_');
    expect(safeStem('COM1')).toBe('COM1_');
    expect(safeStem('lpt9')).toBe('lpt9_');
    expect(safeStem('console')).toBe('console');
  });

  it('cuts to 200 bytes without breaking a character', () => {
    expect(Buffer.byteLength(safeStem('a'.repeat(300)))).toBe(MAX_STEM_BYTES);
    for (const unit of ['नमस्ते', '😀', 'é']) {
      const cut = safeStem(unit.repeat(300));
      expect(Buffer.byteLength(cut)).toBeLessThanOrEqual(MAX_STEM_BYTES);
      expect(cut).not.toContain('�');
      expect(unit.repeat(300).startsWith(cut)).toBe(true);
    }
  });

  it('turns an empty result into "file"', () => {
    expect(safeStem('')).toBe('file');
    expect(safeStem('...')).toBe('file');
  });
});

describe('commitFolder', () => {
  const makeTempPages = (pages: number[], ext = 'png'): Promise<string[]> =>
    Promise.all(pages.map((page) => makeTemp(`page-${page}.${ext}`, `page ${page}`)));

  it('creates "<stem> (<ext>)" and pads page numbers to at least 3', async () => {
    const files = await makeTempPages([1, 2, 3]);
    const committed = await commitFolder({ files, dir: outDir, stem: 'report', ext: 'png' });
    const folder = join(outDir, 'report (png)');
    expect(committed).toEqual([
      folder,
      join(folder, 'page-001.png'),
      join(folder, 'page-002.png'),
      join(folder, 'page-003.png'),
    ]);
    expect(await readFile(join(folder, 'page-002.png'), 'utf8')).toBe('page 2');
    await expect(stat(files[0] ?? '')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps real page numbers for a page range', async () => {
    const files = await makeTempPages([2, 3, 5]);
    const committed = await commitFolder({ files, dir: outDir, stem: 'report', ext: 'png' });
    expect(committed.slice(1).map((path) => path.split('/').at(-1))).toEqual([
      'page-002.png',
      'page-003.png',
      'page-005.png',
    ]);
  });

  it('a folder name that is taken gets (1), and the existing folder is left alone', async () => {
    await mkdir(join(outDir, 'report (png)'));
    await writeFile(join(outDir, 'report (png)', 'keep.txt'), 'mine');
    const files = await makeTempPages([1]);
    const [folder] = await commitFolder({ files, dir: outDir, stem: 'report', ext: 'png' });
    expect(folder).toBe(join(outDir, 'report (png) (1)'));
    expect(await readdir(join(outDir, 'report (png)'))).toEqual(['keep.txt']);
  });

  it('keeps the names an extractor gave, and its own extensions', async () => {
    const files = await Promise.all([makeTemp('page-003-01.jpg'), makeTemp('page-003-02.png')]);
    const committed = await commitFolder({ files, dir: outDir, stem: 'book', ext: 'images' });
    expect(committed.slice(1).map((path) => path.split('/').at(-1))).toEqual([
      'page-003-01.jpg',
      'page-003-02.png',
    ]);
    expect(committed[0]).toBe(join(outDir, 'book (images)'));
  });

  it('names files by position when two of them share a name', async () => {
    await mkdir(join(tempDir, 'a'));
    await mkdir(join(tempDir, 'b'));
    const files = [join(tempDir, 'a', 'out.png'), join(tempDir, 'b', 'out.png')];
    await Promise.all(files.map((file) => writeFile(file, file)));
    const committed = await commitFolder({ files, dir: outDir, stem: 'merged', ext: 'png' });
    expect(committed.slice(1).map((path) => path.split('/').at(-1))).toEqual([
      'page-001.png',
      'page-002.png',
    ]);
  });

  it('handles a 1,800-page book: width 4, in order', async () => {
    const pages = Array.from({ length: BIG_BOOK_PAGES }, (_slot, index) => index + 1);
    const files = await makeTempPages(pages);
    const committed = await commitFolder({ files, dir: outDir, stem: 'book', ext: 'png' });
    const names = (await readdir(committed[0] ?? '')).sort();
    expect(names).toHaveLength(BIG_BOOK_PAGES);
    expect(names[0]).toBe('page-0001.png');
    expect(names.at(-1)).toBe('page-1800.png');
    expect(committed.slice(1).map((path) => path.split('/').at(-1))).toEqual(names);
  });

  it('removes what it created when a file fails midway, and keeps the temp files', async () => {
    const files = await makeTempPages([1, 2, 3]);
    let linked = 0;
    const fsOps = failing({
      link: (existing, target) => {
        linked += 1;
        return linked === 3 ? Promise.reject(errno('ENOSPC')) : realFs.link(existing, target);
      },
    });
    const failure = await failureOf(
      commitFolder({ files, dir: outDir, stem: 'report', ext: 'png', fsOps }),
    );
    expect(failure.error.code).toBe('DISK_FULL');
    expect(await readdir(outDir)).toEqual([]);
    for (const file of files) expect((await stat(file)).isFile()).toBe(true);
  });

  it('rollback never deletes a folder it did not create', async () => {
    await mkdir(join(outDir, 'report (png)'));
    await writeFile(join(outDir, 'report (png)', 'keep.txt'), 'mine');
    const files = await makeTempPages([1]);
    const fsOps = failing({ link: () => Promise.reject(errno('EACCES')) });
    await failureOf(commitFolder({ files, dir: outDir, stem: 'report', ext: 'png', fsOps }));
    expect(await readdir(join(outDir, 'report (png)'))).toEqual(['keep.txt']);
  });

  it('works across devices too (EXDEV on every link)', async () => {
    const files = await makeTempPages([1, 2]);
    const fsOps = failing({
      link: (existing, target) =>
        String(existing).startsWith(tempDir)
          ? Promise.reject(errno('EXDEV'))
          : realFs.link(existing, target),
    });
    const committed = await commitFolder({ files, dir: outDir, stem: 'far', ext: 'png', fsOps });
    expect(await readdir(committed[0] ?? '')).toEqual(['page-001.png', 'page-002.png']);
  });
});

describe('the source file is never changed', () => {
  it('its bytes, size and mtime are the same after commits that fall back to copying', async () => {
    const original = join(root, `original-${counter}.heic`);
    await writeFile(original, 'precious');
    const before = await stat(original);
    const produced = await makeTemp('out.png');
    const fsOps = failing({ link: () => Promise.reject(errno('EPERM')) });
    await commitFile({ src: produced, dir: outDir, stem: 'original', ext: 'png', fsOps });
    const after = await stat(original);
    expect(await readFile(original, 'utf8')).toBe('precious');
    expect([after.size, after.mtimeMs]).toEqual([before.size, before.mtimeMs]);
  });
});
