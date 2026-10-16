import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDocs, headingSlugs } from '../../scripts/check-docs.mjs';

const docsDir = join(import.meta.dirname, '..', '..', 'docs');

describe('docs:check', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const write = (files: Record<string, string>) => {
    dir = mkdtempSync(join(tmpdir(), 'filecon-docs-'));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  };

  it('passes on the real docs', () => {
    expect(checkDocs(docsDir)).toEqual([]);
  });

  it('passes on valid same-file and cross-file anchors', () => {
    write({
      'A.md': '# 1. Intro\n\nSee [b](B.md#2-the-thing) and [here](#1-intro).\n',
      'B.md': '## 2. The `thing`\n',
    });
    expect(checkDocs(dir)).toEqual([]);
  });

  it('fails on a broken anchor', () => {
    write({ 'A.md': '# Intro\n', 'B.md': 'x\n\n[a](A.md#outro)\n' });
    expect(checkDocs(dir)).toEqual(['B.md:3 → A.md#outro']);
  });

  it('fails on a missing file', () => {
    write({ 'A.md': '[gone](GONE.md)\n' });
    expect(checkDocs(dir)).toEqual(['A.md:1 → GONE.md']);
  });

  it('ignores links in code and external links', () => {
    write({ 'A.md': '```\n[x](NOPE.md)\n```\n`[y](NOPE.md)` [z](https://example.com/#a)\n' });
    expect(checkDocs(dir)).toEqual([]);
  });

  it('slugs like GitHub, including duplicates and symbols', () => {
    expect([...headingSlugs('### M0-1 Workspace scaffold ☐\n## Dup\n## Dup\n')]).toEqual([
      'm0-1-workspace-scaffold-',
      'dup',
      'dup-1',
    ]);
  });
});
