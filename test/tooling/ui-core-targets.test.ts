import type { DetectResult, Format, TargetsResult } from '../../packages/core/src/types/index.ts';
import { describe, expect, it } from 'vitest';
import { createProductionRegistry } from '../../packages/core/src/host.ts';
import { buildGraph } from '../../packages/core/src/graph/index.ts';
import { targets } from '../../packages/core/src/graph/index.ts';
import { reducer, type Action } from '../../packages/app/src/renderer/store/reducer.ts';
import {
  convertBlocker,
  plannedJobs,
  readyCount,
  rowTargets,
  targetsKey,
} from '../../packages/app/src/renderer/store/selectors.ts';
import { initialState, type State } from '../../packages/app/src/renderer/store/state.ts';

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

/** What the app does: one targets() call per distinct format, and one per merge group. */
const stateFor = (files: DetectResult[], groupPaths: string[] = []) => {
  const grouped = files.filter((file) => groupPaths.includes(file.path));
  const wanted = [
    ...files.map((file) => [file.format ?? '']),
    ...(grouped.length > 0 ? [grouped.map((file) => file.format ?? '')] : []),
  ];
  const byKey = new Map<string, TargetsResult>(
    wanted.map((formats) => [
      targetsKey(formats),
      targets({ available, full, formats: [...new Set(formats)] }),
    ]),
  );
  const actions: Action[] = [
    { type: 'core/status', status: 'ready', restarts: 0 },
    { type: 'files/added', results: files },
    ...(grouped.length > 0 ? [{ type: 'group/created', paths: groupPaths } as const] : []),
    { type: 'targets/loaded', byKey },
  ];
  return actions.reduce(reducer, initialState);
};

const offered = (state: State, path: string): string[] => {
  const file = state.files.find((candidate) => candidate.path === path);
  return file === undefined ? [] : rowTargets(state, file).map((option) => option.format);
};

describe('row and group state from the real core targets()', () => {
  it('two pdfs offer pdf only as a merge group', () => {
    const files = [detected('/a.pdf', 'pdf'), detected('/b.pdf', 'pdf')];
    expect(offered(stateFor(files), '/a.pdf')).toEqual([]); // a lone pdf has no target in M1
    const state = stateFor(files, ['/a.pdf', '/b.pdf']);
    expect(state.choices.get('group-1')?.target).toBe('pdf');
    expect(plannedJobs(state).map((planned) => planned.request.kind)).toEqual(['merge']);
  });

  it('a png offers images and pdf as ready single-file targets', () => {
    const state = reducer(stateFor([detected('/a.png', 'png')]), {
      type: 'row/target',
      id: '/a.png',
      target: 'jpg',
    });
    expect(offered(state, '/a.png')).toEqual(expect.arrayContaining(['jpg', 'webp', 'pdf']));
    expect(readyCount(state)).toBe(1);
  });

  it('a mixed batch converts each row to its own target', () => {
    let state = stateFor([detected('/a.png', 'png'), detected('/b.jpg', 'jpg')]);
    state = reducer(state, { type: 'row/target', id: '/a.png', target: 'jpg' });
    state = reducer(state, { type: 'row/target', id: '/b.jpg', target: 'webp' });
    expect(plannedJobs(state).map((planned) => planned.request)).toEqual([
      expect.objectContaining({ input: '/a.png', target: 'jpg' }),
      expect.objectContaining({ input: '/b.jpg', target: 'webp' }),
    ]);
  });

  it('a docx to pdf is locked while LibreOffice is missing', () => {
    const state = reducer(stateFor([detected('/a.docx', 'docx')]), {
      type: 'row/target',
      id: '/a.docx',
      target: 'pdf',
    });
    const [file] = state.files;
    if (file === undefined) throw new Error('no file');
    expect(rowTargets(state, file).find((option) => option.format === 'pdf')?.status).toBe(
      'needs-pack',
    );
    expect(readyCount(state)).toBe(0);
    expect(convertBlocker(state)).toBe('locked');
  });
});
