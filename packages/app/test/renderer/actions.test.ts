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
