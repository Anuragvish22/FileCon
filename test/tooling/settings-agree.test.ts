import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../../packages/app/src/main/settings.ts';
import { PARAMS } from '../../packages/core/src/rpc/protocol.ts';

// P29: core re-checks settings at the RPC edge and main validates the full object. Both must reject
// the same broken shapes, so a case that only one of them catches shows up here.
const broken: [string, unknown][] = [
  ['wrong version', { ...DEFAULT_SETTINGS, version: 2 }],
  ['not an object', 'nope'],
  ['unknown output mode', { ...DEFAULT_SETTINGS, output: { mode: 'elsewhere' } }],
  ['custom output without dir', { ...DEFAULT_SETTINGS, output: { mode: 'custom' } }],
  ['concurrency 0', { ...DEFAULT_SETTINGS, concurrency: 0 }],
  ['concurrency 33', { ...DEFAULT_SETTINGS, concurrency: 33 }],
  ['concurrency 1.5', { ...DEFAULT_SETTINGS, concurrency: 1.5 }],
  ['concurrency text', { ...DEFAULT_SETTINGS, concurrency: 'many' }],
  ['engine path not a string', { ...DEFAULT_SETTINGS, engines: { paths: { a: 1 }, priority: [] } }],
  ['priority not strings', { ...DEFAULT_SETTINGS, engines: { paths: {}, priority: [1] } }],
];

// Only main knows the UI fields (core never sees theme, accent or language: CONTRACTS section 10).
const uiOnly: [string, unknown][] = [
  ['unknown accent', { ...DEFAULT_SETTINGS, ui: { ...DEFAULT_SETTINGS.ui, accent: 'pink' } }],
  ['unknown locale', { ...DEFAULT_SETTINGS, ui: { ...DEFAULT_SETTINGS.ui, language: 'xx' } }],
  ['unknown theme', { ...DEFAULT_SETTINGS, ui: { ...DEFAULT_SETTINGS.ui, theme: 'neon' } }],
  [
    'relative engine path',
    { ...DEFAULT_SETTINGS, engines: { paths: { a: 'soffice' }, priority: [] } },
  ],
];

const coreAccepts = (settings: unknown): boolean => {
  try {
    PARAMS.settingsApply({ settings });
    return true;
  } catch {
    return false;
  }
};

describe('core and main settings validation agree (P29)', () => {
  it('both accept the defaults', () => {
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(coreAccepts(DEFAULT_SETTINGS)).toBe(true);
  });

  it.each(broken)('both reject: %s', (_name, settings) => {
    expect(parseSettings(settings)).toBeUndefined();
    expect(coreAccepts(settings)).toBe(false);
  });

  it.each(uiOnly)('main rejects: %s', (_name, settings) => {
    expect(parseSettings(settings)).toBeUndefined();
  });
});
