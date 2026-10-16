import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/registry.ts';
import type { Combiner, Converter } from '../src/types/index.ts';

const converter = (id: string): Converter => ({
  id,
  engineId: id,
  pack: 'builtin',
  edges: [{ from: 'png', to: 'jpg', cost: 1 }],
  available: () => Promise.resolve(true),
  convert: () => Promise.resolve([]),
});

const combiner = (id: string): Combiner => ({
  id,
  accepts: 'pdf',
  output: 'pdf',
  combine: () => Promise.resolve(''),
});

describe('registry', () => {
  it('keeps registration order and separates the kinds', () => {
    const reg = createRegistry();
    const merge = combiner('merge-pdf');
    reg.register(converter('b'));
    reg.register(merge);
    reg.register(converter('a'));
    reg.register(converter('c'));
    expect(reg.converters().map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(reg.combiners()).toEqual([merge]);
  });

  it('throws on a duplicate id, across kinds too', () => {
    const reg = createRegistry();
    reg.register(converter('sharp'));
    expect(() => reg.register(converter('sharp'))).toThrow('sharp');
    expect(() => reg.register(combiner('sharp'))).toThrow('sharp');
  });

  it('returns the registered object, or undefined for an unknown id', () => {
    const reg = createRegistry();
    const sharp = converter('sharp');
    reg.register(sharp);
    expect(reg.get('sharp')).toBe(sharp);
    expect(reg.get('nope')).toBeUndefined();
  });
});
