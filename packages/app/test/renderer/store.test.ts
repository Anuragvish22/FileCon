import type { DetectResult, Job, TargetsResult } from '@filecon/core/types';
import { describe, expect, it } from 'vitest';
import { reducer, type Action } from '../../src/renderer/store/reducer.ts';
import {
  batchSummary,
  canConvert,
  inputFormats,
  mergeChoice,
  pagesValid,
  visibleOptions,
} from '../../src/renderer/store/selectors.ts';
import { initialState, type State } from '../../src/renderer/store/state.ts';

const detected = (path: string, format: string | null = 'png'): DetectResult => ({
  path,
  size: 1,
  format,
  byContent: format,
  byExt: format,
  mismatch: false,
});

const job = (id: string, state: Job['state']): Job =>
  ({
    id,
    batchId: 'b',
    kind: 'convert',
    state,
    outputs: [],
    notes: [],
    createdAt: 0,
  }) as unknown as Job;

const TARGETS: TargetsResult = {
  convert: [
    { format: 'jpg', status: 'ready', lossy: [], fanOut: false, options: ['quality'] },
    { format: 'docx', status: 'needs-pack', pack: 'office', lossy: [], fanOut: false, options: [] },
  ],
  merge: [{ combinerId: 'merge-pdf', output: 'pdf', status: 'ready', fanOut: false }],
  extract: [],
};

const run = (actions: Action[], from: State = initialState): State => actions.reduce(reducer, from);

const ready = (): State =>
  run([
    { type: 'core/status', status: 'ready', restarts: 0 },
    { type: 'files/added', results: [detected('/a.png'), detected('/b.png')] },
    { type: 'targets/loaded', result: TARGETS },
  ]);

describe('add files, pick a target, job done (happy path)', () => {
  it('walks the whole flow', () => {
    let state = ready();
    expect(inputFormats(state)).toEqual(['png']);
    expect(canConvert(state)).toBe(false); // no target yet
    state = run([{ type: 'selection/target', target: 'jpg' }], state);
    expect(canConvert(state)).toBe(true);
    expect(visibleOptions(state)).toEqual(['quality']);
    state = run([{ type: 'jobs/updated', job: job('1', 'running') }], state);
    expect(batchSummary(state)).toMatchObject({ total: 1, active: true });
    state = run([{ type: 'jobs/updated', job: job('1', 'done') }], state);
    expect(batchSummary(state)).toMatchObject({ active: false, counts: { done: 1 } });
  });
});

describe('reducer', () => {
  it('ignores a file added twice and clears detecting rows', () => {
    const state = run([
      { type: 'files/detecting', paths: ['/a.png'] },
      { type: 'files/added', results: [detected('/a.png')] },
      { type: 'files/added', results: [detected('/a.png')] },
    ]);
    expect(state.files).toHaveLength(1);
    expect(state.detecting).toEqual([]);
  });

  it('reorders files', () => {
    const state = run([
      {
        type: 'files/added',
        results: [detected('/a.png'), detected('/b.png'), detected('/c.png')],
      },
      { type: 'files/moved', from: 2, to: 0 },
    ]);
    expect(state.files.map((file) => file.path)).toEqual(['/c.png', '/a.png', '/b.png']);
  });

  it('resets the target when it is no longer offered', () => {
    const state = run(
      [
        {
          type: 'targets/loaded',
          result: {
            ...TARGETS,
            convert: TARGETS.convert.filter((option) => option.format === 'docx'),
          },
        },
      ],
      run([{ type: 'selection/target', target: 'jpg' }], ready()),
    );
    expect(state.selection.target).toBeNull();
  });

  it('keeps a job in its submit position when it updates', () => {
    const state = run([
      { type: 'jobs/updated', job: job('1', 'queued') },
      { type: 'jobs/updated', job: job('2', 'queued') },
      { type: 'jobs/updated', job: job('1', 'done') },
    ]);
    expect([...state.jobs.keys()]).toEqual(['1', '2']);
  });

  it('queues paths dropped before core is ready', () => {
    const state = run([{ type: 'paths/queued', paths: ['/a.png'] }]);
    expect(state.queuedPaths).toEqual(['/a.png']);
    expect(run([{ type: 'paths/dequeued' }], state).queuedPaths).toEqual([]);
  });
});

describe('selectors', () => {
  it('a target that needs a pack cannot be submitted', () => {
    const state = run([{ type: 'selection/target', target: 'docx' }], ready());
    expect(canConvert(state)).toBe(false);
  });

  it('nothing can be submitted until core is ready', () => {
    const state = run(
      [{ type: 'core/status', status: 'restarting', restarts: 1 }],
      run([{ type: 'selection/target', target: 'jpg' }], ready()),
    );
    expect(canConvert(state)).toBe(false);
  });

  it('shows merge for 2 files, not for 1 unless the route fans out', () => {
    const two = run([{ type: 'selection/target', target: 'pdf' }], ready());
    expect(mergeChoice(two)?.combinerId).toBe('merge-pdf');
    const one = run([{ type: 'files/removed', path: '/b.png' }], two);
    expect(mergeChoice(one)).toBeUndefined();
  });

  it('files with an error or no format are not sent', () => {
    const state = run([{ type: 'files/added', results: [detected('/x.bin', null)] }], ready());
    expect(inputFormats(state)).toEqual(['png']);
  });
});

describe('pagesValid', () => {
  it.each(['', '1', '2-3,7', '10-', '-4', ' 1 - 3 , 7 '])('accepts %j', (text) => {
    expect(pagesValid(text)).toBe(true);
  });
  it.each(['0', 'a', '3-1', '1,,2', '1-2-3', ','])('rejects %j', (text) => {
    expect(pagesValid(text)).toBe(false);
  });
});

describe('a target only a merge can make', () => {
  it('cannot be submitted as single-file conversions, only with the merge on', () => {
    const state = run([{ type: 'selection/target', target: 'pdf' }], {
      ...ready(),
      targets: { status: 'ready', result: { ...TARGETS, convert: [] } },
    });
    expect(canConvert(state)).toBe(false);
    expect(canConvert(run([{ type: 'selection/merge', on: true }], state))).toBe(true);
  });
});
