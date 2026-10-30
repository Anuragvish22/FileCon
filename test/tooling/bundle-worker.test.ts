import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('bundled sharp worker', () => {
  it('is built as out/main/worker.js, the file the converter spawns when bundled', () => {
    expect(read('packages/core/src/converters/sharp/converter.ts')).toContain('`./worker.${');
    expect(read('packages/app/electron.vite.config.ts')).toMatch(
      /^\s*worker: resolve\(.*converters\/sharp\/worker\.ts/m,
    );
  });
});
