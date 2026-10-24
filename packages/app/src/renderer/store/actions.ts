import type {
  ConvertOptions,
  CoreError,
  Format,
  OptionKey,
  Settings,
  TargetsResult,
} from '@filecon/core/types';
import type { FileconApi } from '../../preload/api.ts';
import { neededTargets, plannedJobs, targetsKey } from './selectors.ts';
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
    const wanted = neededTargets(getState());
    if (wanted.length === 0) {
      dispatch({ type: 'targets/loaded', byKey: new Map() });
      return;
    }
    dispatch({ type: 'targets/loading' });
    try {
      const answers = await Promise.all(wanted.map((formats) => api.targets(formats)));
      const byKey = new Map<string, TargetsResult>(
        wanted.map((formats, index) => [targetsKey(formats), answers[index] as TargetsResult]),
      );
      if (run === targetsRun) dispatch({ type: 'targets/loaded', byKey });
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
    if (paths.length === 0) return Promise.resolve(); // a row dragged inside the list carries no files
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
    dropFiles: (dropped: File[]): Promise<void> =>
      addPaths(dropped.map((file) => api.pathForFile(file)).filter((path) => path !== '')),
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
    pickTarget: (id: string, target: Format | null): void => {
      dispatch({ type: 'row/target', id, target });
    },
    pickTargetForAll: (target: Format): void => {
      dispatch({ type: 'all/target', target });
    },
    setOption: (id: string, key: OptionKey, value: unknown): void => {
      dispatch({ type: 'row/option', id, key, value });
    },
    resetOptions: (id: string): void => {
      dispatch({ type: 'row/reset', id });
    },
    applyOptionsToAll: (options: ConvertOptions): void => {
      dispatch({ type: 'all/options', options });
    },
    mergeFiles: (paths: string[]): void => {
      dispatch({ type: 'group/created', paths });
      refreshTargets();
    },
    unmerge: (id: string): void => {
      dispatch({ type: 'group/dissolved', id });
    },
    moveMember: (move: { id: string; from: number; to: number }): void => {
      dispatch({ type: 'group/moved', ...move });
    },
    submit: (): Promise<void> =>
      guarded(async () => {
        const planned = plannedJobs(getState());
        if (planned.length === 0) return;
        const requests = planned.map((job) => job.request);
        dispatch({ type: 'submit/started' });
        try {
          const { jobIds } = await api.submit(requests);
          dispatch({
            type: 'submit/finished',
            owners: planned.map((job) => job.owner),
            jobIds,
            requests,
          });
        } catch (caught) {
          dispatch({ type: 'submit/failed' });
          throw caught;
        }
      }),
    retry: (jobId: string): Promise<void> =>
      guarded(async () => {
        const state = getState();
        const request = state.requests.get(jobId);
        const owner = [...state.fileJobs].find(([, id]) => id === jobId)?.[0];
        if (request === undefined || owner === undefined) return;
        const { jobIds } = await api.submit([request]);
        dispatch({ type: 'submit/finished', owners: [owner], jobIds, requests: [request] });
      }),
    clearFinished: (): void => {
      dispatch({ type: 'jobs/cleared' });
    },
    reveal: (path: string): Promise<void> => guarded(() => api.reveal(path)),
    refreshEngines: (): Promise<void> =>
      guarded(async () => {
        dispatch({ type: 'engines/loaded', engines: await api.refreshEngines() });
      }),
    chooseEnginePath: (engineId: string): Promise<void> =>
      guarded(async () => {
        const path = await api.chooseEngine(engineId);
        const current = getState().settings;
        if (path === null || current === null) return;
        dispatch({
          type: 'settings/loaded',
          settings: await api.setSettings({
            engines: { ...current.engines, paths: { ...current.engines.paths, [engineId]: path } },
          }),
        });
      }),
    openExternal: (url: string): Promise<void> => guarded(() => api.openExternal(url)),
    installEngine: (engineId: string): Promise<void> =>
      guarded(async () => {
        await api.installEngine(engineId);
        dispatch({ type: 'engines/loaded', engines: await api.engines() });
      }),
    chooseOutputDir: (): Promise<void> =>
      guarded(async () => {
        const dir = await api.chooseDir();
        if (dir !== null)
          dispatch({
            type: 'settings/loaded',
            settings: await api.setSettings({ output: { mode: 'custom', dir } }),
          });
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
