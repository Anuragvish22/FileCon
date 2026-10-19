import { open, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { coreError } from './errors.ts';
import { byExt as formatByExt, canonical } from './formats.ts';
import type { CoreError, DetectResult, ErrorCode, Format } from './types/index.ts';

// ARCHITECTURE section 7. The same head buffer also serves the text sniff below.
// file-type's own reasonableDetectionSizeInBytes: most signatures sit inside it (its typings don't export it).
const HEAD_BYTES = 4100;
const CFB_EXT = 'cfb';
const ZIP_EXT = 'zip';
// An XML prolog matches as "xml", but svg is XML too, so the text rule must still run.
const XML_EXT = 'xml';
const CFB_FORMATS: readonly Format[] = ['doc', 'xls', 'ppt'];
const ZIP_FORMATS: readonly Format[] = ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'];
// Text formats have no magic bytes: the marker must appear in the head.
const TEXT_MARKERS: Readonly<Record<Format, string>> = { svg: '<svg' };

const failure = (path: string, size: number, code: ErrorCode): DetectResult => {
  const error: CoreError = coreError(code, { name: basename(path) });
  return { path, size, format: null, byContent: null, byExt: null, mismatch: false, error };
};

const readHead = async (path: string): Promise<Buffer> => {
  const handle = await open(path, 'r');
  try {
    const head = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

/** Never throws: a per-file problem is reported in `error` (CONTRACTS section 3). */
export const detect = async (path: string): Promise<DetectResult> => {
  let size: number;
  try {
    const stats = await stat(path);
    if (!stats.isFile()) return failure(path, 0, 'INPUT_UNREADABLE');
    size = stats.size;
  } catch (cause) {
    const missing = (cause as NodeJS.ErrnoException).code === 'ENOENT';
    return failure(path, 0, missing ? 'INPUT_NOT_FOUND' : 'INPUT_UNREADABLE');
  }
  if (size === 0) return failure(path, size, 'EMPTY_FILE');

  let head: Buffer;
  try {
    head = await readHead(path);
  } catch {
    return failure(path, size, 'INPUT_UNREADABLE');
  }

  const byExt = formatByExt(extname(path));
  const matched = await fileTypeFromBuffer(head);
  const byContent = matched === undefined ? null : canonical(matched.ext);
  const unsupported = (): DetectResult => ({
    ...failure(path, size, 'UNSUPPORTED_FORMAT'),
    byContent,
    byExt,
  });
  const supported = (fields: { format: Format; mismatch: boolean }): DetectResult => ({
    path,
    size,
    byContent,
    byExt,
    ...fields,
  });

  // Containers share one signature, so the extension decides and no mismatch is possible.
  if (matched?.ext === CFB_EXT)
    return byExt !== null && CFB_FORMATS.includes(byExt)
      ? supported({ format: byExt, mismatch: false })
      : unsupported();
  if (matched?.ext === ZIP_EXT)
    return byExt !== null && ZIP_FORMATS.includes(byExt)
      ? supported({ format: byExt, mismatch: false })
      : unsupported();

  if (byContent !== null)
    return supported({ format: byContent, mismatch: byExt !== null && byExt !== byContent });

  // A content match we don't support (mp4, tar…) must not fall through to the text rules.
  if (matched !== undefined && matched.ext !== XML_EXT) return unsupported();
  const marker = byExt === null ? undefined : TEXT_MARKERS[byExt];
  if (byExt !== null && marker !== undefined && head.toString('latin1').includes(marker))
    return supported({ format: byExt, mismatch: false });
  return unsupported();
};
