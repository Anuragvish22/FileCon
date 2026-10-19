import { constants } from 'node:fs';
import { copyFile, link, mkdir, rename, rmdir, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { CoreFailure } from '../errors.ts';

// ARCHITECTURE section 10: the never-overwrite guarantee.
const MAX_ATTEMPTS = 999;
const MAX_STEM_BYTES = 200;
const MIN_PAD = 3;
const PART_SUFFIX = '.filecon-part';
const FALLBACK_CODES: readonly string[] = ['EXDEV', 'EPERM', 'ENOTSUP'];
const DISK_FULL_CODE = 'ENOSPC';
const EXISTS_CODE = 'EEXIST';
const MISSING_CODE = 'ENOENT';
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const ILLEGAL_CHARS = /[<>:"/\\|?*\p{Cc}]/gu;
const TRAILING_DOTS_AND_SPACES = /[. ]+$/;
const PAGE_NAME = /^page-(\d+)\.(.+)$/;

/** The `fs` calls used here, injectable so tests can simulate EXDEV, EPERM and ENOSPC. */
export interface FsOps {
  link: typeof link;
  unlink: typeof unlink;
  copyFile: typeof copyFile;
  stat: typeof stat;
  rename: typeof rename;
  mkdir: typeof mkdir;
  rmdir: typeof rmdir;
}
const realFs: FsOps = { link, unlink, copyFile, stat, rename, mkdir, rmdir };

// Shared by every job in the host, so two jobs never pick the same name.
const reserved = new Set<string>();

const errnoCode = (cause: unknown): string | undefined => (cause as NodeJS.ErrnoException).code;

const toFailure = (cause: unknown, name: string): CoreFailure => {
  if (cause instanceof CoreFailure) return cause;
  if (errnoCode(cause) === DISK_FULL_CODE) return new CoreFailure('DISK_FULL');
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new CoreFailure('OUTPUT_WRITE_FAILED', { name }, detail);
};

const cutToBytes = (text: string, maxBytes: number): string => {
  let kept = '';
  let used = 0;
  for (const character of text) {
    used += Buffer.byteLength(character);
    if (used > maxBytes) break;
    kept += character;
  }
  return kept;
};

/** The output folder may be FAT or a Windows share, so a name valid for the source may not be valid there. */
export const safeStem = (name: string): string => {
  const cleaned = name.replace(ILLEGAL_CHARS, '_').replace(TRAILING_DOTS_AND_SPACES, '');
  const unreserved = WINDOWS_RESERVED.test(cleaned) ? `${cleaned}_` : cleaned;
  const cut = cutToBytes(unreserved, MAX_STEM_BYTES).replace(TRAILING_DOTS_AND_SPACES, '');
  return cut === '' ? 'file' : cut;
};

const exists = async (path: string, fsOps: FsOps): Promise<boolean> => {
  try {
    await fsOps.stat(path);
    return true;
  } catch (cause) {
    if (errnoCode(cause) === MISSING_CODE) return false;
    throw cause;
  }
};

/** Copy beside the destination, then move into place. Only reached where `link` can't work. */
const placeByCopy = async (src: string, destination: string, fsOps: FsOps): Promise<boolean> => {
  const part = destination + PART_SUFFIX;
  try {
    await fsOps.copyFile(src, part, constants.COPYFILE_EXCL);
  } catch (cause) {
    if (errnoCode(cause) === EXISTS_CODE) return false;
    throw cause;
  }
  try {
    await fsOps.link(part, destination);
  } catch (cause) {
    const code = errnoCode(cause);
    if (code === EXISTS_CODE) return false;
    if (code === undefined || !FALLBACK_CODES.includes(code)) throw cause;
    // shortcut: check-then-rename can race another program, only fileCon's own jobs are guarded (by `reserved`). Upgrade if a no-link filesystem sees real clashes.
    if (await exists(destination, fsOps)) return false;
    await fsOps.rename(part, destination);
  } finally {
    await fsOps.unlink(part).catch(() => undefined);
  }
  return true;
};

/** Puts a file at `destination` unless something is already there. Never touches `src`. */
const placeExclusive = async (src: string, destination: string, fsOps: FsOps): Promise<boolean> => {
  try {
    await fsOps.link(src, destination);
    return true;
  } catch (cause) {
    const code = errnoCode(cause);
    if (code === EXISTS_CODE) return false;
    if (code === undefined || !FALLBACK_CODES.includes(code)) throw cause;
    return placeByCopy(src, destination, fsOps);
  }
};

const withAttempt = (base: string, attempt: number): string =>
  attempt === 0 ? base : `${base} (${attempt})`;

/** Runs `claim` on `<base>`, `<base> (1)`… until one is free. `claim` returns false when the name is taken. */
const firstFree = async (
  name: string,
  candidates: (attempt: number) => string,
  claim: (candidate: string) => Promise<boolean>,
): Promise<string> => {
  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = candidates(attempt);
    if (reserved.has(candidate)) continue;
    reserved.add(candidate);
    try {
      if (await claim(candidate)) return candidate;
    } finally {
      reserved.delete(candidate);
    }
  }
  throw new CoreFailure('OUTPUT_WRITE_FAILED', { name }, 'no free name');
};

interface CommitFileInput {
  src: string;
  dir: string;
  stem: string;
  ext: string;
  fsOps?: FsOps;
}

/** Moves one finished file into `dir` as `<stem>.<ext>`, or `<stem> (1).<ext>` and so on. Returns the new path. */
export const commitFile = async ({
  src,
  dir,
  stem,
  ext,
  fsOps = realFs,
}: CommitFileInput): Promise<string> => {
  const safe = safeStem(stem);
  try {
    const committed = await firstFree(
      `${safe}.${ext}`,
      (attempt) => join(dir, `${withAttempt(safe, attempt)}.${ext}`),
      (candidate) => placeExclusive(src, candidate, fsOps),
    );
    // The output exists now: a failed cleanup of the temp copy must not fail the job.
    await fsOps.unlink(src).catch(() => undefined);
    return committed;
  } catch (cause) {
    throw toFailure(cause, `${safe}.${ext}`);
  }
};

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

/** Fan-out pages are re-padded to the widest page number, everything else keeps its name. */
const folderNames = (files: readonly string[]): string[] => {
  const names = files.map((file) => basename(file));
  const pages = names.map((name) => PAGE_NAME.exec(name));
  const widest = Math.max(
    MIN_PAD,
    ...pages.map((match) => (match?.[1] === undefined ? 0 : String(Number(match[1])).length)),
  );
  const named = names.map((name, index) => {
    const match = pages[index];
    return match?.[1] === undefined
      ? name
      : `page-${pad(Number(match[1]), widest)}.${match[2] ?? ''}`;
  });
  if (new Set(named.map((name) => name.toLowerCase())).size === named.length) return named;
  // Two files share a name (outputs of different inputs): name them by position instead.
  const width = Math.max(MIN_PAD, String(files.length).length);
  return names.map(
    (name, index) =>
      `page-${pad(index + 1, width)}${name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''}`,
  );
};

interface CommitFolderInput {
  files: readonly string[];
  dir: string;
  stem: string;
  ext: string;
  fsOps?: FsOps;
}

/**
 * Commits many files into a new folder `<stem> (<ext>)`. Returns `[folder, ...files]`.
 * If any file fails, what this call created is removed again.
 */
export const commitFolder = async ({
  files,
  dir,
  stem,
  ext,
  fsOps = realFs,
}: CommitFolderInput): Promise<string[]> => {
  const safe = safeStem(stem);
  const folderLabel = `${safe} (${ext})`;
  const created: string[] = [];
  let folder: string | undefined;
  try {
    folder = await firstFree(
      folderLabel,
      (attempt) => join(dir, withAttempt(folderLabel, attempt)),
      async (candidate) => {
        try {
          await fsOps.mkdir(candidate);
          return true;
        } catch (cause) {
          if (errnoCode(cause) === EXISTS_CODE) return false;
          throw cause;
        }
      },
    );
    const names = folderNames(files);
    for (const [index, file] of files.entries()) {
      const destination = join(folder, names[index] ?? basename(file));
      if (!(await placeExclusive(file, destination, fsOps)))
        throw new CoreFailure('OUTPUT_WRITE_FAILED', { name: basename(destination) }, 'exists');
      created.push(destination);
    }
  } catch (cause) {
    for (const path of created) await fsOps.unlink(path).catch(() => undefined);
    if (folder !== undefined) await fsOps.rmdir(folder).catch(() => undefined);
    throw toFailure(cause, folderLabel);
  }
  // Same reason as in commitFile: the temp copies are only removed once everything is saved.
  for (const file of files) await fsOps.unlink(file).catch(() => undefined);
  return [folder, ...created];
};
