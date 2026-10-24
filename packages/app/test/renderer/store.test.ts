import type { DetectResult, Job, TargetsResult } from '@filecon/core/types';
import { describe, expect, it } from 'vitest';
import { reducer, type Action } from '../../src/renderer/store/reducer.ts';
import {
  batchOptionKeys,
  batchSummary,
  convertBlocker,
  neededTargets,
  pagesValid,
  plannedJobs,
  readyCount,
  rowState,
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

const job = (id: string, state: Job['state'], inputs: string[] = []): Job =>
  ({
    id,
    batchId: 'b',
    kind: 'convert',
    state,
    inputs,
    outputs: [],
    notes: [],
    createdAt: 0,
  }) as unknown as Job;

const PNG_TARGETS: TargetsResult = {
  convert: [
    { format: 'jpg', status: 'ready', lossy: [], fanOut: false, options: ['quality'] },
    { format: 'pdf', status: 'ready', lossy: [], fanOut: false, options: ['pageSize'] },
  ],
  merge: [{ combinerId: 'merge-pdf', output: 'pdf', status: 'ready', fanOut: false }],
  extract: [],
};
const DOCX_TARGETS: TargetsResult = {
  convert: [
    { format: 'pdf', status: 'needs-pack', pack: 'office', lossy: [], fanOut: false, options: [] },
  ],
  merge: [],
  extract: [],
};
const BY_KEY = new Map<string, TargetsResult>([
  ['png', PNG_TARGETS],
  ['docx', DOCX_TARGETS],
  ['docx,png', { convert: [], merge: PNG_TARGETS.merge, extract: [] }],
]);

const only = <Item>(list: Item[]): Item => {
  const [first] = list;
  if (first === undefined) throw new Error('expected one item');
  return first;
};

const run = (actions: Action[], from: State = initialState): State => actions.reduce(reducer, from);

const ready = (): State =>
  run([
    { type: 'core/status', status: 'ready', restarts: 0 },
    { type: 'files/added', results: [detected('/a.png'), detected('/b.png')] },
    { type: 'targets/loaded', byKey: BY_KEY },
  ]);

describe('add files, pick a target per row, job done (happy path)', () => {
  it('walks the whole flow', () => {
    let state = ready();
    expect(neededTargets(state)).toEqual([['png']]);
    expect(readyCount(state)).toBe(0);
    expect(convertBlocker(state)).toBe('nothing');
    state = run([{ type: 'row/target', id: '/a.png', target: 'jpg' }], state);
    expect(readyCount(state)).toBe(1); // /b.png still has no target
    expect(visibleOptions(state, detected('/a.png'))).toEqual(['quality']);
    const planned = only(plannedJobs(state));
    expect(planned).toEqual({
      owner: '/a.png',
      request: { kind: 'convert', input: '/a.png', target: 'jpg', options: {} },
    });
    state = run(
      [
        {
          type: 'submit/finished',
          owners: ['/a.png'],
          jobIds: ['1'],
          requests: [planned.request],
        },
        { type: 'jobs/updated', job: job('1', 'running', ['/a.png']) },
      ],
      state,
    );
    expect(rowState(state, '/a.png')).toBe('running');
    expect(rowState(state, '/b.png')).toBe('ready');
    expect(readyCount(state)).toBe(0); // a started row is not sent twice
    state = run([{ type: 'jobs/updated', job: job('1', 'done', ['/a.png']) }], state);
    expect(rowState(state, '/a.png')).toBe('done');
    expect(batchSummary(state)).toMatchObject({ active: false, finished: true });
  });
});

describe('a target and options per row', () => {
  const mixed = (): State =>
    run([
      { type: 'core/status', status: 'ready', restarts: 0 },
      { type: 'files/added', results: [detected('/a.png'), detected('/b.docx', 'docx')] },
      { type: 'targets/loaded', byKey: BY_KEY },
    ]);

  it('asks targets() once per distinct format', () => {
    expect(neededTargets(mixed())).toEqual([['png'], ['docx']]);
  });

  it('Convert all to sets only the rows that can make the format', () => {
    const state = run([{ type: 'all/target', target: 'pdf' }], mixed());
    expect(plannedJobs(state).map((planned) => planned.owner)).toEqual(['/a.png']); // docx is locked
    expect(state.choices.get('/b.docx')?.target).toBe('pdf'); // locked rows still show the pick
  });

  it('Options for all skips rows that do not honour a key', () => {
    let state = run([{ type: 'all/target', target: 'pdf' }], mixed());
    state = run([{ type: 'all/options', options: { pageSize: 'a4', quality: 50 } }], state);
    expect(state.choices.get('/a.png')?.options).toEqual({ pageSize: 'a4' });
    expect(state.choices.get('/b.docx')?.options ?? {}).toEqual({});
    expect(batchOptionKeys(state)).toEqual(['pageSize']);
  });

  it('only keys the route honours are sent', () => {
    const state = run(
      [
        { type: 'row/target', id: '/a.png', target: 'pdf' },
        { type: 'row/option', id: '/a.png', key: 'pageSize', value: 'a4' },
        { type: 'row/option', id: '/a.png', key: 'quality', value: 10 },
      ],
      mixed(),
    );
    expect(plannedJobs(state)[0]?.request).toMatchObject({ options: { pageSize: 'a4' } });
  });

  it('a locked target names the pack as the reason Convert is off', () => {
    const state = run([{ type: 'row/target', id: '/b.docx', target: 'pdf' }], mixed());
    expect(convertBlocker(state)).toBe('locked');
  });

  it('an invalid page range keeps the row out of the batch', () => {
    const state = run(
      [
        { type: 'row/target', id: '/a.png', target: 'pdf' },
        { type: 'row/option', id: '/a.png', key: 'pages', value: '3-1' },
      ],
      mixed(),
    );
    expect(readyCount(state)).toBe(0);
  });
});

describe('remembering a target per source format', () => {
  it('a new file of that format starts with the last pick', () => {
    const picked = run([{ type: 'row/target', id: '/a.png', target: 'jpg' }], ready());
    const next = run(
      [
        { type: 'files/added', results: [detected('/c.png')] },
        { type: 'targets/loaded', byKey: BY_KEY },
      ],
      picked,
    );
    expect(next.choices.get('/c.png')?.target).toBe('jpg');
  });

  it('a target core no longer offers is cleared', () => {
    const state = run(
      [{ type: 'targets/loaded', byKey: new Map([['png', DOCX_TARGETS]]) }],
      run([{ type: 'row/target', id: '/a.png', target: 'jpg' }], ready()),
    );
    expect(state.choices.get('/a.png')?.target).toBeNull();
  });
});

describe('merge groups', () => {
  const grouped = (): State =>
    run(
      [
        { type: 'group/created', paths: ['/a.png', '/b.png'] },
        { type: 'targets/loaded', byKey: BY_KEY },
      ],
      ready(),
    );

  it('members leave the single rows and the group gets a target and one request', () => {
    const state = grouped();
    expect(state.groups).toEqual([{ id: 'group-1', members: ['/a.png', '/b.png'] }]);
    expect(plannedJobs(state)).toEqual([
      {
        owner: 'group-1',
        request: {
          kind: 'merge',
          inputs: ['/a.png', '/b.png'],
          combinerId: 'merge-pdf',
          options: {},
        },
      },
    ]);
  });

  it('keeps page order when a member is moved', () => {
    const state = run([{ type: 'group/moved', id: 'group-1', from: 1, to: 0 }], grouped());
    expect(state.groups[0]?.members).toEqual(['/b.png', '/a.png']);
  });

  it('needs two files, and a group left with one dissolves', () => {
    expect(run([{ type: 'group/created', paths: ['/a.png'] }], ready()).groups).toEqual([]);
    const state = run([{ type: 'files/removed', path: '/a.png' }], grouped());
    expect(state.groups).toEqual([]);
    expect(state.files.map((file) => file.path)).toEqual(['/b.png']);
  });

  it('Unmerge gives the rows back', () => {
    const state = run([{ type: 'group/dissolved', id: 'group-1' }], grouped());
    expect(state.groups).toEqual([]);
    expect(state.files).toHaveLength(2);
  });

  it('the finished group is cleared with its members', () => {
    const planned = plannedJobs(grouped());
    const state = run(
      [
        {
          type: 'submit/finished',
          owners: ['group-1'],
          jobIds: ['7'],
          requests: [only(planned).request],
        },
        { type: 'jobs/updated', job: job('7', 'done', ['/a.png', '/b.png']) },
        { type: 'jobs/cleared' },
      ],
      grouped(),
    );
    expect(state.files).toEqual([]);
    expect(state.groups).toEqual([]);
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

  it('a detecting path is a detecting row', () => {
    expect(rowState(run([{ type: 'files/detecting', paths: ['/a.png'] }]), '/a.png')).toBe(
      'detecting',
    );
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

  it('Clear keeps a row whose job is still running', () => {
    const planned = plannedJobs(
      run([{ type: 'row/target', id: '/a.png', target: 'jpg' }], ready()),
    );
    const state = run(
      [
        {
          type: 'submit/finished',
          owners: ['/a.png'],
          jobIds: ['1'],
          requests: [only(planned).request],
        },
        { type: 'jobs/updated', job: job('1', 'running', ['/a.png']) },
        { type: 'files/cleared' },
      ],
      run([{ type: 'row/target', id: '/a.png', target: 'jpg' }], ready()),
    );
    expect(state.files.map((file) => file.path)).toEqual(['/a.png']);
  });

  it('Clear forgets the finished jobs, so the next batch counts from zero', () => {
    const picked = run([{ type: 'row/target', id: '/a.png', target: 'jpg' }], ready());
    const planned = only(plannedJobs(picked));
    const state = run(
      [
        { type: 'submit/finished', owners: ['/a.png'], jobIds: ['1'], requests: [planned.request] },
        { type: 'jobs/updated', job: job('1', 'done', ['/a.png']) },
        { type: 'files/cleared' },
      ],
      picked,
    );
    expect(batchSummary(state)).toMatchObject({ total: 0, counts: { done: 0 } });
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
  it('nothing can be submitted until core is ready', () => {
    const state = run(
      [{ type: 'core/status', status: 'restarting', restarts: 1 }],
      run([{ type: 'row/target', id: '/a.png', target: 'jpg' }], ready()),
    );
    expect(convertBlocker(state)).toBe('core');
  });

  it('waits for detection', () => {
    expect(convertBlocker(run([{ type: 'files/detecting', paths: ['/x.png'] }], ready()))).toBe(
      'detecting',
    );
  });

  it('files with an error or no format are unsupported and not asked about', () => {
    const state = run([{ type: 'files/added', results: [detected('/x.bin', null)] }], ready());
    expect(neededTargets(state)).toEqual([['png']]);
    expect(rowState(state, '/x.bin')).toBe('unsupported');
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
