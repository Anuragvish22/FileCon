import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const packages = join(import.meta.dirname, '..', '..', 'packages');

// Tests live in <package>/test/, mirroring src/ (CLAUDE.md Testing)
describe('layout', () => {
  it('has no test files under packages/*/src', () => {
    const misplaced = readdirSync(packages).flatMap((pkg) => {
      const src = join(packages, pkg, 'src');
      let files: string[] = [];
      try {
        files = readdirSync(src, { recursive: true, encoding: 'utf8' });
      } catch {
        // a package without src/ has nothing to check
      }
      return files.filter((f) => /\.test\.tsx?$/.test(f)).map((f) => join(pkg, 'src', f));
    });
    expect(misplaced).toEqual([]);
  });
});
