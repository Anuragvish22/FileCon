import type { CoreError, JobRequest, OptionKey, Settings } from '@filecon/core/types';
import type { FileconApi } from '../../preload/api.ts';
import { convertibleFiles, inputFormats, mergeChoice, visibleOptions } from './selectors.ts';
import type { Action } from './reducer.ts';
import type { State } from './state.ts';

export interface ActionDeps {
  api: FileconApi;
  dispatch: (action: Action) => void;
  getState: () => State;
}

const TARGETS_DEBOUNCE_MS = 150;

const isCoreError = (value: unknown): value is CoreError =>
  typeof value === 'object' && value !== null && typeof (value as CoreError).code === 'string';

/**
 * The only code that calls `window.filecon` (ARCHITECTURE section 13). Until core is `ready` nothing is
 * sent: drops are queued and `startup()` runs again on every return to `ready` (P35).
 */
export const createActions = ({ api, dispatch, getState }: ActionDeps) => {
  let targetsTimer: ReturnType<typeof setTimeout> | undefined;
  let targetsRun = 0; // a slow answer for an older file list must not overwrite a newer one

  const fail = (caught: unknown): void => {
    const error: CoreError = isCoreError(caught) ? caught : { code: 'INVALID_REQUEST', params: {} };
    dispatch({ type: 'notice/set', notice: { key: `error.${error.code}`, params: error.params } });
  };

  const guarded = async (work: () => Promise<void>): Promise<void> => {
    try {
      await work();
    } catch (caught) {
      fail(caught);
    }
  };

  const loadTargets = async (): Promise<void> => {
    targetsRun += 1;
    const run = targetsRun;
    const formats = inputFormats(getState());
    if (formats.length === 0) {
      dispatch({ type: 'targets/loaded', result: { convert: [], merge: [], extract: [] } });
      return;
    }
    dispatch({ type: 'targets/loading' });
    try {
      const result = await api.targets(formats);
      if (run === targetsRun) dispatch({ type: 'targets/loaded', result });
    } catch (caught) {
      if (run !== targetsRun) return;
      dispatch({
        type: 'targets/failed',
        error: isCoreError(caught) ? caught : { code: 'INVALID_REQUEST', params: {} },
      });
    }
  };

  /** Debounced, so a drop of many files asks once (ARCHITECTURE section 13). */
  const refreshTargets = (): void => {
    clearTimeout(targetsTimer);
    if (getState().core.status !== 'ready') return;
    targetsTimer = setTimeout(() => void loadTargets(), TARGETS_DEBOUNCE_MS);
  };

  const addPaths = (paths: string[]): Promise<void> => {
    if (getState().core.status !== 'ready') {
      dispatch({ type: 'paths/queued', paths });
      return Promise.resolve();
    }
    return guarded(async () => {
      const { files, skipped, capped } = await api.expand(paths);
      if (capped)
        dispatch({
          type: 'notice/set',
          notice: { key: 'drop.capped', params: { count: files.length } },
        });
      else if (skipped > 0)
        dispatch({
          type: 'notice/set',
          notice: { key: 'drop.skipped', params: { added: files.length, skipped } },
        });
      dispatch({ type: 'files/detecting', paths: files });
      const results = await api.detect(files);
      dispatch({ type: 'files/added', results });
      refreshTargets();
    });
  };

  return {
    /** Runs on every transition to `ready`: first start and after each restart. */
    startup: (): Promise<void> =>
      guarded(async () => {
        const [settings, engines] = await Promise.all([api.getSettings(), api.engines()]);
        dispatch({ type: 'settings/loaded', settings });
        dispatch({ type: 'engines/loaded', engines });
        const queued = getState().queuedPaths;
        if (queued.length > 0) {
          dispatch({ type: 'paths/dequeued' });
          await addPaths(queued);
        } else if (getState().files.length > 0) refreshTargets();
      }),
    addPaths,
    chooseFiles: (): Promise<void> =>
      guarded(async () => {
        const paths = await api.openFiles();
        if (paths.length > 0) await addPaths(paths);
      }),
    removeFile: (path: string): void => {
      dispatch({ type: 'files/removed', path });
      refreshTargets();
    },
    moveFile: (move: { from: number; to: number }): void => {
      dispatch({ type: 'files/moved', ...move });
    },
    clearFiles: (): void => {
      dispatch({ type: 'files/cleared' });
    },
    refreshTargets,
    pickTarget: (target: string | null): void => {
      dispatch({ type: 'selection/target', target });
    },
    setMerge: (on: boolean): void => {
      dispatch({ type: 'selection/merge', on });
    },
    setOption: (key: OptionKey, value: unknown): void => {
      dispatch({ type: 'selection/option', key, value });
    },
    submit: (): Promise<void> =>
      guarded(async () => {
        const state = getState();
        const { target, options: chosen } = state.selection;
        const wanted = new Set<string>(visibleOptions(state));
        const options = Object.fromEntries(
          Object.entries(chosen).filter(([key]) => wanted.has(key)),
        );
        const files = convertibleFiles(state);
        const merge = state.selection.mergeMode ? mergeChoice(state) : undefined;
        if (target === null) return;
        const requests: JobRequest[] =
          merge === undefined
            ? files.map((file) => ({ kind: 'convert', input: file.path, target, options }))
            : [
                {
                  kind: 'merge',
                  inputs: files.map((file) => file.path),
                  combinerId: merge.combinerId,
                  options,
                },
              ];
        await api.submit(requests);
      }),
    cancel: (jobId: string): Promise<void> => guarded(() => api.cancel(jobId)),
    cancelAll: (): Promise<void> => guarded(() => api.cancelAll()),
    setPage: (page: State['page']): void => {
      dispatch({ type: 'page/set', page });
    },
    setSettings: (patch: Partial<Settings>): Promise<void> =>
      guarded(async () => {
        dispatch({ type: 'settings/loaded', settings: await api.setSettings(patch) });
      }),
    dismissNotice: (): void => {
      dispatch({ type: 'notice/dismissed' });
    },
  };
};

export type Actions = ReturnType<typeof createActions>;
