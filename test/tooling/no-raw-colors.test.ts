import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const renderer = join(import.meta.dirname, '..', '..', 'packages', 'app', 'src', 'renderer');
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );

describe('colors only come from theme tokens (CLAUDE.md Code style)', () => {
  it('no hex color outside theme/tokens.ts', () => {
    const offenders = files(renderer)
      .filter((file) => /\.(css|tsx?)$/.test(file) && !file.endsWith(join('theme', 'tokens.ts')))
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some((line) => HEX_COLOR.test(line) && !line.includes('content color')),
      );
    expect(offenders).toEqual([]);
  });
});
