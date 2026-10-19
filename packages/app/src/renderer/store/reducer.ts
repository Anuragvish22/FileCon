import type {
  CoreError,
  CoreStatus,
  DetectResult,
  EngineInfo,
  Format,
  Job,
  JobRequest,
  OptionKey,
  Settings,
  TargetsResult,
} from '@filecon/core/types';
import type { Notice, Page, State } from './state.ts';
import { initialState } from './state.ts';

export type Action =
  | { type: 'core/status'; status: CoreStatus; restarts: number }
  | { type: 'paths/queued'; paths: string[] }
  | { type: 'paths/dequeued' }
  | { type: 'files/detecting'; paths: string[] }
  | { type: 'files/added'; results: DetectResult[] }
  | { type: 'files/removed'; path: string }
  | { type: 'files/moved'; from: number; to: number }
  | { type: 'files/cleared' }
  | { type: 'targets/loading' }
  | { type: 'targets/loaded'; result: TargetsResult }
  | { type: 'targets/failed'; error: CoreError }
  | { type: 'selection/target'; target: Format | null }
  | { type: 'selection/merge'; on: boolean }
  | { type: 'selection/option'; key: OptionKey; value: unknown }
  | { type: 'submit/started' }
  | { type: 'submit/finished'; jobIds: string[]; requests: JobRequest[] }
  | { type: 'submit/failed' }
  | { type: 'jobs/updated'; job: Job }
  | { type: 'jobs/cleared' }
  | { type: 'engines/loaded'; engines: EngineInfo[] }
  | { type: 'settings/loaded'; settings: Settings }
  | { type: 'page/set'; page: Page }
  | { type: 'notice/set'; notice: Notice }
  | { type: 'notice/dismissed' };

const FINISHED: readonly Job['state'][] = ['done', 'failed', 'cancelled'];

/** The target survives only while the offered list still has it (ARCHITECTURE section 13). */
const keepTarget = (state: State, result: TargetsResult): State['selection'] => {
  const { target } = state.selection;
  const offered =
    target !== null &&
    (result.convert.some((option) => option.format === target) ||
      result.merge.some((merge) => merge.output === target));
  return offered ? state.selection : { ...state.selection, target: null, mergeMode: false };
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'core/status':
      return { ...state, core: { status: action.status, restarts: action.restarts } };
    case 'paths/queued':
      return { ...state, queuedPaths: [...state.queuedPaths, ...action.paths] };
    case 'paths/dequeued':
      return { ...state, queuedPaths: [] };
    case 'files/detecting':
      return { ...state, detecting: [...state.detecting, ...action.paths] };
    case 'files/added': {
      const known = new Set(state.files.map((file) => file.path));
      const fresh = action.results.filter((result) => !known.has(result.path));
      const done = new Set(action.results.map((result) => result.path));
      return {
        ...state,
        files: [...state.files, ...fresh],
        detecting: state.detecting.filter((path) => !done.has(path)),
      };
    }
    case 'files/removed':
      return { ...state, files: state.files.filter((file) => file.path !== action.path) };
    case 'files/moved': {
      const files = [...state.files];
      const [moved] = files.splice(action.from, 1);
      if (moved === undefined) return state;
      files.splice(action.to, 0, moved);
      return { ...state, files };
    }
    case 'files/cleared':
      return {
        ...state,
        files: [],
        detecting: [],
        targets: { status: 'idle' },
        selection: { ...state.selection, target: null, mergeMode: false },
      };
    case 'targets/loading':
      return { ...state, targets: { status: 'loading' } };
    case 'targets/loaded':
      return {
        ...state,
        targets: { status: 'ready', result: action.result },
        selection: keepTarget(state, action.result),
      };
    case 'targets/failed':
      return { ...state, targets: { status: 'failed', error: action.error } };
    case 'selection/target':
      return {
        ...state,
        selection: { ...state.selection, target: action.target, mergeMode: false },
      };
    case 'selection/merge':
      return { ...state, selection: { ...state.selection, mergeMode: action.on } };
    case 'selection/option': {
      const options = { ...state.selection.options };
      if (action.value === undefined) delete options[action.key];
      else Object.assign(options, { [action.key]: action.value });
      return { ...state, selection: { ...state.selection, options } };
    }
    case 'submit/started':
      return { ...state, submit: 'busy' };
    case 'submit/failed':
      return { ...state, submit: 'idle' };
    case 'submit/finished': {
      const requests = new Map(state.requests);
      action.jobIds.forEach((id, index) => {
        const request = action.requests[index];
        if (request !== undefined) requests.set(id, request);
      });
      return { ...state, submit: 'idle', requests };
    }
    case 'jobs/updated':
      // Map.set keeps the original position of an existing id, so rows stay in submit order.
      return { ...state, jobs: new Map(state.jobs).set(action.job.id, action.job) };
    case 'jobs/cleared':
      return {
        ...state,
        jobs: new Map([...state.jobs].filter(([, job]) => !FINISHED.includes(job.state))),
      };
    case 'engines/loaded':
      return { ...state, engines: action.engines };
    case 'settings/loaded':
      return { ...state, settings: action.settings };
    case 'page/set':
      return { ...state, page: action.page };
    case 'notice/set':
      return { ...state, notice: action.notice };
    case 'notice/dismissed':
      return { ...state, notice: null };
  }
};

export { initialState };
