import { describe, expect, it } from 'vitest';
import { COST } from '../src/costs.ts';
import { createRegistry } from '../src/registry.ts';
import { fakeCombiner, fakeConverter } from './fakes.ts';

const converter = (id: string) =>
  fakeConverter({ id, edges: [{ from: 'png', to: 'jpg', cost: COST.lossyReencode }] });
const combiner = (id: string) => fakeCombiner({ id, accepts: 'pdf', output: 'pdf' });

describe('registry', () => {
  it('keeps registration order and separates the kinds', () => {
    const registry = createRegistry();
    const merge = combiner('merge-pdf');
    registry.register(converter('b'));
    registry.register(merge);
    registry.register(converter('a'));
    registry.register(converter('c'));
    expect(registry.converters().map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(registry.combiners()).toEqual([merge]);
  });

  it('throws on a duplicate id, across kinds too', () => {
    const registry = createRegistry();
    registry.register(converter('sharp'));
    expect(() => registry.register(converter('sharp'))).toThrow('sharp');
    expect(() => registry.register(combiner('sharp'))).toThrow('sharp');
  });

  it('returns the registered object, or undefined for an unknown id', () => {
    const registry = createRegistry();
    const sharp = converter('sharp');
    registry.register(sharp);
    expect(registry.get('sharp')).toBe(sharp);
    expect(registry.get('nope')).toBeUndefined();
  });
});
