import { chmod, copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detect } from '../src/detect.ts';

const fixture = (folder: string, name: string): string =>
  fileURLToPath(new URL(`../../../test/fixtures/${folder}/${name}`, import.meta.url));

// End-of-central-directory record only: file-type reads it as a generic zip, nothing inside.
const EMPTY_ZIP = Buffer.from(`504b0506${'00'.repeat(18)}`, 'hex');

let workDir: string;
beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'filecon-detect-'));
});
afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

/** Copies a fixture under another name, to test the extension against the content. */
const copyAs = async (folder: string, name: string, copyName: string): Promise<string> => {
  const target = join(workDir, copyName);
  await copyFile(fixture(folder, name), target);
  return target;
};

describe('detect: happy path', () => {
  it.each([
    ['jpg', 'sample.jpg'],
    ['png', 'sample.png'],
    ['webp', 'sample.webp'],
    ['pdf', 'sample.pdf'],
    ['docx', 'sample.docx'],
    ['doc', 'sample.doc'],
    ['xls', 'sample.xls'],
    ['ppt', 'sample.ppt'],
    ['svg', 'sample.svg'],
  ])('%s is detected and agrees with its extension', async (format, name) => {
    const result = await detect(fixture(format, name));
    expect(result).toMatchObject({ format, byExt: format, mismatch: false });
    expect(result.error).toBeUndefined();
    expect(result.size).toBeGreaterThan(0);
  });

  it('doc has no content format, since every CFB looks alike: the extension decides', async () => {
    expect((await detect(fixture('doc', 'sample.doc'))).byContent).toBeNull();
  });

  it('a generic zip with a zip-based extension is accepted by extension', async () => {
    const path = join(workDir, 'plain.docx');
    await writeFile(path, EMPTY_ZIP);
    expect(await detect(path)).toMatchObject({ format: 'docx', byContent: null, mismatch: false });
  });
});

describe('detect: must also pass', () => {
  it('a .jpg that is really webp is treated as webp and flagged', async () => {
    const result = await detect(await copyAs('webp', 'sample.webp', 'liar.jpg'));
    expect(result).toMatchObject({
      format: 'webp',
      byContent: 'webp',
      byExt: 'jpg',
      mismatch: true,
    });
  });

  it('a CFB file with a non-CFB extension is unsupported', async () => {
    for (const name of ['wrong.jpg', 'wrong.docx', 'wrong']) {
      const result = await detect(await copyAs('doc', 'sample.doc', name));
      expect(result.format).toBeNull();
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    }
  });

  it('a zip with a non-zip-format extension is unsupported', async () => {
    const path = join(workDir, 'archive.jpg');
    await writeFile(path, EMPTY_ZIP);
    expect((await detect(path)).error?.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('plain text renamed to .jpg is unsupported', async () => {
    const result = await detect(fixture('txt-renamed', 'sample.jpg'));
    expect(result).toMatchObject({ format: null, byExt: 'jpg', byContent: null });
    expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('an svg extension without <svg in the head is unsupported', async () => {
    const path = join(workDir, 'fake.svg');
    await writeFile(path, 'just some text');
    expect((await detect(path)).error?.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('a recognised but unsupported content type is unsupported even with a known extension', async () => {
    const path = join(workDir, 'movie.svg');
    await writeFile(
      path,
      Buffer.concat([Buffer.from('0000001866747970', 'hex'), Buffer.from('mp42<svg')]),
    );
    expect((await detect(path)).error?.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('a binary without an extension is detected by content', async () => {
    const result = await detect(await copyAs('png', 'sample.png', 'noext'));
    expect(result).toMatchObject({ format: 'png', byExt: null, mismatch: false });
  });

  it('an empty file is EMPTY_FILE', async () => {
    const path = join(workDir, 'empty.png');
    await writeFile(path, '');
    const result = await detect(path);
    expect(result.error).toEqual({ code: 'EMPTY_FILE', params: { name: 'empty.png' } });
  });

  it('a missing file is INPUT_NOT_FOUND', async () => {
    const result = await detect(join(workDir, 'gone.png'));
    expect(result.error?.code).toBe('INPUT_NOT_FOUND');
  });

  it('a directory is INPUT_UNREADABLE', async () => {
    const folder = join(workDir, 'folder.png');
    await mkdir(folder);
    expect((await detect(folder)).error?.code).toBe('INPUT_UNREADABLE');
  });

  it.skipIf(process.getuid?.() === 0)(
    'a file without read permission is INPUT_UNREADABLE',
    async () => {
      const path = await copyAs('png', 'sample.png', 'locked.png');
      await chmod(path, 0o000);
      expect((await detect(path)).error?.code).toBe('INPUT_UNREADABLE');
    },
  );

  it('a symlink to a file is followed', async () => {
    const link = join(workDir, 'link.png');
    await symlink(fixture('png', 'sample.png'), link);
    expect(await detect(link)).toMatchObject({ format: 'png', mismatch: false });
  });
});
