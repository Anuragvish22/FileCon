import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const contracts = readFileSync(join(root, 'docs', 'CONTRACTS.md'), 'utf8');

// CONTRACTS section number → its mirror file under core/src/types/ (CONTRACTS intro)
const MIRRORS: Record<number, string> = {
  1: 'domain',
  2: 'options',
  3: 'detect',
  4: 'jobs',
  5: 'errors',
  6: 'rpc',
  7: 'ipc',
  8: 'settings',
  9: 'engines',
  10: 'text',
};

const sectionCode = (section: number): string => {
  const body = contracts.split(new RegExp(`^## ${section}\\. `, 'm'))[1]?.split(/^## \d+\. /m)[0];
  const blocks = [...(body ?? '').matchAll(/```ts\n([\s\S]*?)```/g)];
  return blocks.map((block) => block[1]).join('\n');
};

// Prettier changes quotes, commas and line breaks; the declarations must stay identical.
const normalize = (code: string): string =>
  code
    .replace(/^import .*$/gm, '')
    .replace(/^\/\/ Mirror of .*$/gm, '')
    .replace(/\bexport /g, '')
    .replace(/"/g, "'")
    .replace(/\s+/g, '')
    .replace(/[,;](?=[})\]])/g, '')
    .replace(/(?<=[{([])[,;]/g, '');

describe('types mirror (CONTRACTS code blocks)', () => {
  for (const [section, file] of Object.entries(MIRRORS)) {
    it(`section ${section} matches core/src/types/${file}.ts`, () => {
      const mirror = readFileSync(
        join(root, 'packages', 'core', 'src', 'types', `${file}.ts`),
        'utf8',
      );
      const documented = normalize(sectionCode(Number(section)));
      expect(documented.length).toBeGreaterThan(0);
      expect(normalize(mirror)).toBe(documented);
    });
  }
});
