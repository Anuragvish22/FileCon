import { describe, expect, it } from 'vitest';
import { byExt, canonical, FORMATS, info } from '../src/formats.ts';

describe('formats', () => {
  it('maps aliases to the canonical id', () => {
    expect(canonical('jpeg')).toBe('jpg');
    expect(canonical('tif')).toBe('tiff');
    expect(canonical('png')).toBe('png');
  });

  it('uses the first ext as the output ext', () => {
    expect(info('jpg')?.exts[0]).toBe('jpg');
    expect(info('tiff')?.exts[0]).toBe('tiff');
  });

  it('looks up exts case-insensitively, with or without the dot', () => {
    expect(byExt('JPEG')).toBe('jpg');
    expect(byExt('jfif')).toBe('jpg');
    expect(byExt('.Tif')).toBe('tiff');
    expect(byExt('docx')).toBe('docx');
  });

  it('returns null for unknown exts and ids', () => {
    expect(byExt('xyz')).toBeNull();
    expect(byExt('')).toBeNull();
    expect(canonical('xyz')).toBeNull();
    expect(info('xyz')).toBeUndefined();
  });

  it('has unique ids and exts, all lowercase', () => {
    const exts = FORMATS.flatMap((format) => format.exts);
    expect(new Set(FORMATS.map((format) => format.id)).size).toBe(FORMATS.length);
    expect(new Set(exts).size).toBe(exts.length);
    for (const name of [...FORMATS.map((format) => format.id), ...exts])
      expect(name).toBe(name.toLowerCase());
  });
});
