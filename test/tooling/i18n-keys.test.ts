import { describe, expect, it } from 'vitest';
import { createProductionRegistry } from '../../packages/core/src/host.ts';
import { ENGINE_SPECS } from '../../packages/core/src/engines/specs.ts';
import { FORMATS } from '../../packages/core/src/formats.ts';
import { ERROR_CODES } from '../../packages/core/src/types/errors.ts';
import en from '../../packages/app/src/locales/en.json' with { type: 'json' };

const keys = new Set(Object.keys(en));
const missing = (wanted: string[]): string[] => wanted.filter((key) => !keys.has(key));

// Every `what` core raises with INVALID_REQUEST (options.ts, runner page check).
// shortcut: this list is written by hand, extend it when a new `what` is added.
const INVALID_WHAT = [
  'quality-range',
  'dpi-range',
  'width-range',
  'height-range',
  'page-size-value',
  'tiff-compression-value',
  'page-past-end',
];

const registry = createProductionRegistry({ dataDir: '/unused', enginePath: () => undefined });
const lossyIds = registry
  .converters()
  .flatMap((converter) => converter.edges.flatMap((edge) => (edge.lossy ? [edge.lossy] : [])));

describe('en.json covers every key core can emit (CONTRACTS section 10)', () => {
  it('error.<code> for every error code', () => {
    expect(missing(ERROR_CODES.map((code) => `error.${code}`))).toEqual([]);
  });

  it('format.<id> and category.<category> for every format', () => {
    expect(missing(FORMATS.map((format) => `format.${format.id}`))).toEqual([]);
    expect(missing(FORMATS.map((format) => `category.${format.category}`))).toEqual([]);
  });

  it('pack.<id> for every pack that an engine or converter belongs to', () => {
    const packs = [
      ...ENGINE_SPECS.map((spec) => spec.pack),
      ...registry.converters().map((converter) => converter.pack),
    ];
    expect(missing(packs.map((pack) => `pack.${pack}`))).toEqual([]);
  });

  it('lossy.<id> for every lossy edge', () => {
    expect(lossyIds.length).toBeGreaterThan(0);
    expect(missing(lossyIds.map((id) => `lossy.${id}`))).toEqual([]);
  });

  it('invalid.<what> for every INVALID_REQUEST reason', () => {
    expect(missing(INVALID_WHAT.map((what) => `invalid.${what}`))).toEqual([]);
  });

  it('has no key that nothing refers to (a typo guard)', () => {
    const known = [
      ...ERROR_CODES.map((code) => `error.${code}`),
      ...INVALID_WHAT.map((what) => `invalid.${what}`),
      ...FORMATS.flatMap((format) => [`format.${format.id}`, `category.${format.category}`]),
      ...lossyIds.map((id) => `lossy.${id}`),
    ];
    const unknown = [...keys].filter(
      (key) => !known.includes(key) && !/^(pack|install|app|nav|banner|notice|drop)\./.test(key),
    );
    expect(unknown).toEqual([]);
  });
});
