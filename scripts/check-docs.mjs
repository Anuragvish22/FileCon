// Checks that every relative link and #anchor in the top-level .md files of a folder resolves.
// Usage: node scripts/check-docs.mjs [dir]   (default: docs)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** GitHub-style heading slugs, with -1, -2 suffixes for duplicates. @param {string} md */
export function headingSlugs(md) {
  /** @type {Set<string>} */
  const slugs = new Set();
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const line of codeFree(md, { dropInline: false })) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading?.[1]) continue;
    const text = heading[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/ /g, '-');
    const duplicates = seen.get(base) ?? 0;
    seen.set(base, duplicates + 1);
    slugs.add(duplicates === 0 ? base : `${base}-${duplicates}`);
  }
  return slugs;
}

/** Lines with fenced blocks blanked; inline code is removed, or only its backticks when dropInline is false. @param {string} md @param {{ dropInline?: boolean }} [options] */
function codeFree(md, { dropInline = true } = {}) {
  let fenced = false;
  return md.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return '';
    }
    return fenced ? '' : line.replace(/`([^`]*)`/g, dropInline ? '' : '$1');
  });
}

/** @param {string} dir @param {string[]} [extraFiles] absolute paths of .md files outside dir, e.g. the README @returns {string[]} one "file:line → target" entry per broken link */
export function checkDocs(dir, extraFiles = []) {
  const files = [...readdirSync(dir).filter((name) => name.endsWith('.md')), ...extraFiles];
  /** @type {Map<string, Set<string>>} */
  const slugCache = new Map();
  /** @param {string} path */
  const slugsOf = (path) => {
    let slugs = slugCache.get(path);
    if (!slugs) {
      slugs = headingSlugs(readFileSync(path, 'utf8'));
      slugCache.set(path, slugs);
    }
    return slugs;
  };

  /** @type {string[]} */
  const broken = [];
  for (const file of files) {
    const path = resolve(dir, file);
    codeFree(readFileSync(path, 'utf8')).forEach((line, lineIndex) => {
      for (const [, target = ''] of line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
        const [rel = '', anchor] = target.split('#');
        const dest = rel ? resolve(dirname(path), rel) : path;
        const ok =
          existsSync(dest) && (!anchor || (dest.endsWith('.md') && slugsOf(dest).has(anchor)));
        if (!ok) broken.push(`${basename(file)}:${lineIndex + 1} → ${target}`);
      }
    });
  }
  return broken;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = resolve(
    process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'docs'),
  );
  const readme = join(dir, '..', 'README.md');
  const broken = checkDocs(dir, existsSync(readme) ? [readme] : []);
  for (const entry of broken) console.error(`broken link: ${entry}`);
  console.log(broken.length ? `${broken.length} broken link(s)` : 'docs: all links ok');
  process.exitCode = broken.length ? 1 : 0;
}
