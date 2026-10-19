import { describe, expect, it } from 'vitest';
import { validateOptions } from '../src/options.ts';

const whatOf = (options: Parameters<typeof validateOptions>[0]): unknown => {
  try {
    validateOptions(options);
  } catch (caught) {
    return (caught as { error: { code: string; params: { what?: string } } }).error;
  }
  return undefined;
};

describe('validateOptions', () => {
  it('accepts empty options and every value on the boundary', () => {
    expect(() => validateOptions({})).not.toThrow();
    expect(() =>
      validateOptions({
        quality: 1,
        dpi: 600,
        width: 65535,
        height: 1,
        pageSize: 'letter',
        tiffCompression: 'none',
        grayscale: true,
      }),
    ).not.toThrow();
  });

  it.each([
    ['quality', { quality: 0 }],
    ['quality', { quality: 101 }],
    ['quality', { quality: 90.5 }],
    ['dpi', { dpi: 71 }],
    ['dpi', { dpi: 601 }],
    ['width', { width: 0 }],
    ['width', { width: 65536 }],
    ['width', { width: Number.NaN }],
    ['height', { height: -3 }],
  ])('%s out of range is INVALID_REQUEST with what "%s-range"', (key, options) => {
    expect(whatOf(options)).toEqual({ code: 'INVALID_REQUEST', params: { what: `${key}-range` } });
  });

  it('an unknown pageSize or tiffCompression is INVALID_REQUEST', () => {
    // @ts-expect-error: not one of the allowed values
    expect(whatOf({ pageSize: 'a3' })).toMatchObject({ params: { what: 'page-size-value' } });
    // @ts-expect-error: not one of the allowed values
    expect(whatOf({ tiffCompression: 'zip' })).toMatchObject({
      params: { what: 'tiff-compression-value' },
    });
  });
});
