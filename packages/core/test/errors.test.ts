import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CoreFailure, coreError, toCoreError } from '../src/errors.ts';
import { ERROR_CODES } from '../src/types/index.ts';

const contracts = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'docs', 'CONTRACTS.md'),
  'utf8',
);

// Codes in the first column of the CONTRACTS section 5 table
const tableCodes = () => {
  const section = contracts.split(/^## 5\. /m)[1]?.split(/^## /m)[0] ?? '';
  return [...section.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((match) => match[1]);
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
    for (const error of [
      coreError('INVALID_REQUEST', { what: 'page-past-end', page: 9, count: 5 }),
      coreError('TIMEOUT', { engine: 'libreoffice', name: 'a.docx' }, 'killed'),
      coreError('CANCELLED'),
    ]) {
      expect(JSON.parse(JSON.stringify(error))).toEqual(error);
    }
  });

  it('accepts only the allowed param names', () => {
    // @ts-expect-error: "message" is not an allowed param (CONTRACTS section 5); typecheck fails if this compiles
    coreError('EMPTY_FILE', { message: 'a.png is empty' });
  });

  it('CoreFailure is a real Error whose .error is the plain CoreError', () => {
    const failure = new CoreFailure('ENGINE_FAILED', { engine: 'ffmpeg', name: 'a.mp4' }, 'exit 1');
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe('CoreFailure');
    expect(failure.stack).toContain('CoreFailure');
    expect(failure.error).toEqual(
      coreError('ENGINE_FAILED', { engine: 'ffmpeg', name: 'a.mp4' }, 'exit 1'),
    );
    expect(structuredClone(failure.error)).toEqual(failure.error);
    expect(JSON.parse(JSON.stringify(failure.error))).toEqual(failure.error);
  });
});

describe('toCoreError', () => {
  it('a CoreFailure gives its plain error', () => {
    const failure = new CoreFailure('TIMEOUT', { engine: 'libreoffice' }, 'killed');
    expect(toCoreError(failure)).toEqual(failure.error);
  });

  it('ENOSPC is DISK_FULL', () => {
    const noSpace = Object.assign(new Error('write failed'), { code: 'ENOSPC' });
    expect(toCoreError(noSpace)).toEqual(coreError('DISK_FULL'));
  });

  it('a plain Error is ENGINE_FAILED with its stack as detail', () => {
    const plain = new Error('sharp blew up');
    const error = toCoreError(plain);
    expect(error.code).toBe('ENGINE_FAILED');
    expect(error.detail).toContain('sharp blew up');
    expect(error.detail).toBe(plain.stack);
  });

  it('a value that is not an Error is ENGINE_FAILED with the value as text', () => {
    expect(toCoreError('boom')).toEqual(coreError('ENGINE_FAILED', {}, 'boom'));
  });
});
