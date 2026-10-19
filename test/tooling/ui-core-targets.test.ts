import type { DetectResult, Format, TargetsResult } from '../../packages/core/src/types/index.ts';
import { describe, expect, it } from 'vitest';
import { createProductionRegistry } from '../../packages/core/src/host.ts';
import { buildGraph } from '../../packages/core/src/graph/index.ts';
import { targets } from '../../packages/core/src/graph/index.ts';
import { reducer, type Action } from '../../packages/app/src/renderer/store/reducer.ts';
import { canConvert, offeredTargets } from '../../packages/app/src/renderer/store/selectors.ts';
import { initialState } from '../../packages/app/src/renderer/store/state.ts';

// The picker is tested against what core really answers, not against hand-written targets: a made-up
// result once hid that two PDFs offered no PDF (merge outputs are not in `convert`).
const registry = createProductionRegistry({ dataDir: '/unused', enginePath: () => undefined });
const everyId = new Set(registry.converters().map((converter) => converter.id));
const builtinIds = new Set(
  registry
    .converters()
    .filter((converter) => converter.pack === 'builtin')
    .map((converter) => converter.id),
);
const full = buildGraph({ registry, availableIds: everyId, priority: [] });
const available = buildGraph({ registry, availableIds: builtinIds, priority: [] });

const detected = (path: string, format: Format): DetectResult => ({
  path,
  size: 1,
  format,
  byContent: format,
  byExt: format,
  mismatch: false,
});

const stateFor = (files: DetectResult[]) => {
  const formats = [...new Set(files.map((file) => file.format ?? ''))];
  const result: TargetsResult = targets({ available, full, formats });
  const actions: Action[] = [
    { type: 'core/status', status: 'ready', restarts: 0 },
    { type: 'files/added', results: files },
    { type: 'targets/loaded', result },
  ];
  return actions.reduce(reducer, initialState);
};

const formatsOffered = (state: ReturnType<typeof stateFor>): string[] =>
  offeredTargets(state).map((option) => option.format);

describe('picker state from the real core targets()', () => {
  it('two pdfs offer pdf, and only the merge toggle can submit it', () => {
    let state = stateFor([detected('/a.pdf', 'pdf'), detected('/b.pdf', 'pdf')]);
    expect(formatsOffered(state)).toContain('pdf');
    state = reducer(state, { type: 'selection/target', target: 'pdf' });
    expect(canConvert(state)).toBe(false);
    expect(canConvert(reducer(state, { type: 'selection/merge', on: true }))).toBe(true);
  });

  it('one pdf offers nothing in M1', () => {
    expect(formatsOffered(stateFor([detected('/a.pdf', 'pdf')]))).toEqual([]);
  });

  it('a png offers images and pdf as ready single-file targets', () => {
    const state = reducer(stateFor([detected('/a.png', 'png')]), {
      type: 'selection/target',
      target: 'jpg',
    });
    expect(formatsOffered(state)).toEqual(expect.arrayContaining(['jpg', 'webp', 'pdf']));
    expect(canConvert(state)).toBe(true);
  });

  it('a docx to pdf is locked while LibreOffice is missing', () => {
    const state = reducer(stateFor([detected('/a.docx', 'docx')]), {
      type: 'selection/target',
      target: 'pdf',
    });
    expect(offeredTargets(state).find((option) => option.format === 'pdf')?.status).toBe(
      'needs-pack',
    );
    expect(canConvert(state)).toBe(false);
  });
});
