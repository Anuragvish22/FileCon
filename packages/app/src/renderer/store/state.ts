import type {
  ConvertOptions,
  JobRequest,
  CoreError,
  CoreStatus,
  DetectResult,
  EngineInfo,
  Format,
  Job,
  Settings,
  TargetsResult,
} from '@filecon/core/types';

export type Page = 'files' | 'engines' | 'settings';

export type TargetsState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** Keyed by `targetsKey`: one answer per distinct input format and one per merge group. */
  | { status: 'ready'; byKey: Map<string, TargetsResult> }
  | { status: 'failed'; error: CoreError };

/** A message for the user as a text key plus params, so a language change re-renders it. */
export interface Notice {
  key: string;
  params: Record<string, string | number>;
}

/** What one row (or one merge group) will be converted to. */
export interface Choice {
  target: Format | null;
  options: ConvertOptions;
}

/** Files merged into one output. Members keep the order of their pages. */
export interface MergeGroup {
  id: string;
  members: string[];
}

export interface State {
  page: Page;
  core: { status: CoreStatus; restarts: number };
  /** Paths dropped before core was ready (P35). They are expanded and detected once it is. */
  queuedPaths: string[];
  /** Paths being detected right now, for the row spinner. */
  detecting: string[];
  files: DetectResult[];
  /** By file path or group id, which is what a row is called everywhere (`fileId`). */
  choices: Map<string, Choice>;
  groups: MergeGroup[];
  nextGroup: number;
  /** The last target picked per source format, so the next file of that type starts with it. */
  lastTargets: Partial<Record<Format, Format>>;
  /** Which job runs for a file path or group id, so its row can show progress and the result. */
  fileJobs: Map<string, string>;
  targets: TargetsState;
  /** In submit order. */
  jobs: Map<string, Job>;
  /** What each job was made from, so Retry can send it again. */
  requests: Map<string, JobRequest>;
  /** `busy` while a submit call is in flight, so Convert can't be clicked twice. */
  submit: 'idle' | 'busy';
  engines: EngineInfo[];
  settings: Settings | null;
  notice: Notice | null;
}

export const initialState: State = {
  page: 'files',
  core: { status: 'starting', restarts: 0 },
  queuedPaths: [],
  detecting: [],
  files: [],
  choices: new Map(),
  groups: [],
  nextGroup: 1,
  lastTargets: {},
  fileJobs: new Map(),
  targets: { status: 'idle' },
  jobs: new Map(),
  requests: new Map(),
  submit: 'idle',
  engines: [],
  settings: null,
  notice: null,
};
