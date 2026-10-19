import type {
  ConvertOptions,
  CoreError,
  CoreStatus,
  DetectResult,
  EngineInfo,
  Format,
  Job,
  Settings,
  TargetsResult,
} from '@filecon/core/types';

export type Page = 'convert' | 'engines' | 'settings';

export type TargetsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: TargetsResult }
  | { status: 'failed'; error: CoreError };

/** A message for the user as a text key plus params, so a language change re-renders it. */
export interface Notice {
  key: string;
  params: Record<string, string | number>;
}

export interface State {
  page: Page;
  core: { status: CoreStatus; restarts: number };
  /** Paths dropped before core was ready (P35). They are expanded and detected once it is. */
  queuedPaths: string[];
  /** Paths being detected right now, for the row spinner. */
  detecting: string[];
  files: DetectResult[];
  selection: { target: Format | null; mergeMode: boolean; options: ConvertOptions };
  targets: TargetsState;
  /** In submit order. */
  jobs: Map<string, Job>;
  engines: EngineInfo[];
  settings: Settings | null;
  notice: Notice | null;
}

export const initialState: State = {
  page: 'convert',
  core: { status: 'starting', restarts: 0 },
  queuedPaths: [],
  detecting: [],
  files: [],
  selection: { target: null, mergeMode: false, options: {} },
  targets: { status: 'idle' },
  jobs: new Map(),
  engines: [],
  settings: null,
  notice: null,
};
