import type { DetectResult } from '@filecon/core/types';
import { describe, expect, it, vi } from 'vitest';
import type { FileconApi } from '../../src/preload/api.ts';
import { createActions } from '../../src/renderer/store/actions.ts';
import { reducer, type Action } from '../../src/renderer/store/reducer.ts';
import { initialState, type State } from '../../src/renderer/store/state.ts';
import { DEFAULT_SETTINGS } from '../../src/main/settings.ts';

const setup = (status: State['core']['status']) => {
  let state: State = { ...initialState, core: { status, restarts: 0 } };
  const api = {
    expand: vi.fn(() => Promise.resolve({ files: ['/a.png'], skipped: 0, capped: false })),
    detect: vi.fn(() => Promise.resolve([{ path: '/a.png', format: 'png' }] as DetectResult[])),
    getSettings: vi.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
    engines: vi.fn(() => Promise.resolve([])),
    submit: vi.fn(() => Promise.resolve({ batchId: 'b', jobIds: ['9'] })),
    targets: vi.fn(() => Promise.resolve({ convert: [], merge: [], extract: [] })),
  };
  const actions = createActions({
    api: api as unknown as FileconApi,
    dispatch: (action: Action) => {
      state = reducer(state, action);
    },
    getState: () => state,
  });
  return { api, actions, state: () => state, setState: (next: State) => (state = next) };
};

describe('P35: nothing is sent before core is ready', () => {
  it('queues a drop while starting, then processes it on startup once ready', async () => {
    const harness = setup('starting');
    await harness.actions.addPaths(['/a.png']);
    expect(harness.api.expand).not.toHaveBeenCalled();
    expect(harness.state().queuedPaths).toEqual(['/a.png']);

    harness.setState({ ...harness.state(), core: { status: 'ready', restarts: 0 } });
    await harness.actions.startup();
    expect(harness.api.expand).toHaveBeenCalledWith(['/a.png']);
    expect(harness.state().queuedPaths).toEqual([]);
    expect(harness.state().files).toHaveLength(1);
    expect(harness.state().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('shows the core error as a notice when a call fails', async () => {
    const harness = setup('ready');
    harness.api.expand.mockRejectedValue({ code: 'CORE_TIMEOUT', params: {} });
    await harness.actions.addPaths(['/a.png']);
    expect(harness.state().notice).toEqual({ key: 'error.CORE_TIMEOUT', params: {} });
  });
});

describe('submit and retry', () => {
  const request = { kind: 'convert', input: '/a.png', target: 'jpg', options: {} } as const;

  it('is busy while the call is in flight, and remembers the request for Retry', async () => {
    const harness = setup('ready');
    let finish: (value: { batchId: string; jobIds: string[] }) => void = () => undefined;
    harness.api.submit.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    harness.setState({
      ...harness.state(),
      files: [
        { path: '/a.png', size: 1, format: 'png', byContent: 'png', byExt: 'png', mismatch: false },
      ],
      choices: new Map([['/a.png', { target: 'jpg', options: {} }]]),
      targets: {
        status: 'ready',
        byKey: new Map([
          [
            'png',
            {
              convert: [{ format: 'jpg', status: 'ready', lossy: [], fanOut: false, options: [] }],
              merge: [],
              extract: [],
            },
          ],
        ]),
      },
    });
    const pending = harness.actions.submit();
    expect(harness.state().submit).toBe('busy');
    finish({ batchId: 'b', jobIds: ['9'] });
    await pending;
    expect(harness.state().submit).toBe('idle');
    expect(harness.state().requests.get('9')).toEqual(request);
    expect(harness.state().fileJobs.get('/a.png')).toBe('9'); // the row finds its job

    await harness.actions.retry('9');
    expect(harness.api.submit).toHaveBeenLastCalledWith([request]);
  });

  it('goes back to idle when the submit fails', async () => {
    const harness = setup('ready');
    harness.api.submit.mockRejectedValue({
      code: 'OUTPUT_DIR_NOT_WRITABLE',
      params: { dir: '/x' },
    });
    harness.setState({
      ...harness.state(),
      files: [
        { path: '/a.png', size: 1, format: 'png', byContent: 'png', byExt: 'png', mismatch: false },
      ],
      choices: new Map([['/a.png', { target: 'jpg', options: {} }]]),
      targets: {
        status: 'ready',
        byKey: new Map([
          [
            'png',
            {
              convert: [{ format: 'jpg', status: 'ready', lossy: [], fanOut: false, options: [] }],
              merge: [],
              extract: [],
            },
          ],
        ]),
      },
    });
    await harness.actions.submit();
    expect(harness.state().submit).toBe('idle');
    expect(harness.state().notice?.key).toBe('error.OUTPUT_DIR_NOT_WRITABLE');
  });
});
