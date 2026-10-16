import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CoreFailure, coreError } from '../src/errors.ts';
import { ERROR_CODES } from '../src/types/index.ts';

const contracts = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'docs', 'CONTRACTS.md'),
  'utf8',
);

// Codes in the first column of the CONTRACTS section 5 table
const tableCodes = () => {
  const section = contracts.split(/^## 5\. /m)[1]?.split(/^## /m)[0] ?? '';
  return [...section.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((m) => m[1]);
};

describe('errors', () => {
  it('builds a CoreError from code and params', () => {
    expect(coreError('EMPTY_FILE', { name: 'a.png' })).toEqual({
      code: 'EMPTY_FILE',
      params: { name: 'a.png' },
    });
  });

  it('keeps detail when given', () => {
    expect(coreError('ENGINE_FAILED', { engine: 'ffmpeg' }, 'stderr tail').detail).toBe(
      'stderr tail',
    );
  });

  it('ERROR_CODES matches the CONTRACTS table exactly, in order', () => {
    const codes = tableCodes();
    expect(codes.length).toBeGreaterThan(0);
    expect(codes).toEqual([...ERROR_CODES]);
  });

  it('survives a JSON round trip unchanged', () => {
    for (const e of [
      coreError('INVALID_REQUEST', { what: 'page-past-end', page: 9, count: 5 }),
      coreError('TIMEOUT', { engine: 'libreoffice', name: 'a.docx' }, 'killed'),
      coreError('CANCELLED'),
    ]) {
      expect(JSON.parse(JSON.stringify(e))).toEqual(e);
    }
  });

  it('accepts only the allowed param names', () => {
    // @ts-expect-error: "message" is not an allowed param (CONTRACTS section 5); typecheck fails if this compiles
    coreError('EMPTY_FILE', { message: 'a.png is empty' });
  });

  it('CoreFailure is a real Error whose .error is the plain CoreError', () => {
    const f = new CoreFailure('ENGINE_FAILED', { engine: 'ffmpeg', name: 'a.mp4' }, 'exit 1');
    expect(f).toBeInstanceOf(Error);
    expect(f.name).toBe('CoreFailure');
    expect(f.stack).toContain('CoreFailure');
    expect(f.error).toEqual(
      coreError('ENGINE_FAILED', { engine: 'ffmpeg', name: 'a.mp4' }, 'exit 1'),
    );
    expect(structuredClone(f.error)).toEqual(f.error);
    expect(JSON.parse(JSON.stringify(f.error))).toEqual(f.error);
  });
});
