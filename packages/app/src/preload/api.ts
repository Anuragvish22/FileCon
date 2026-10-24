import {
  PUSH_CHANNELS,
  type DetectResult,
  type EngineInfo,
  type Format,
  type Job,
  type JobRequest,
  type Settings,
  type SubmitResult,
  type TargetsResult,
  type CoreStatus,
} from '@filecon/core/types';

/** What main answers on every channel (`ipc.ts` handlers wrapped in `index.ts`). */
export type Reply = { ok: true; value: unknown } | { ok: false; error: unknown };

export interface PushEvents {
  'job:update': Job;
  'engines:changed': EngineInfo[];
  'engines:installProgress': unknown;
  'core:status': { status: CoreStatus; restarts: number };
}

export { PUSH_CHANNELS };

export interface PreloadDeps {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  subscribe(channel: string, listener: (data: unknown) => void): () => void;
  pathForFile(file: File): string;
}

/** A failed call rejects with the plain `CoreError`, so the renderer can read `code` and `params`. */
const call = async <Result>(
  deps: PreloadDeps,
  channel: string,
  payload?: unknown,
): Promise<Result> => {
  const reply = (await deps.invoke(channel, payload)) as Reply;
  if (!reply.ok) throw reply.error;
  return reply.value as Result;
};

/** The object behind `window.filecon` (CONTRACTS section 7). */
export const createApi = (deps: PreloadDeps) => ({
  detect: (paths: string[]) => call<DetectResult[]>(deps, 'core:detect', paths),
  targets: (formats: Format[]) => call<TargetsResult>(deps, 'core:targets', formats),
  submit: (requests: JobRequest[]) => call<SubmitResult>(deps, 'job:submit', requests),
  cancel: (jobId: string) => call<void>(deps, 'job:cancel', jobId),
  cancelAll: () => call<void>(deps, 'job:cancelAll'),
  engines: () => call<EngineInfo[]>(deps, 'engines:list'),
  refreshEngines: () => call<EngineInfo[]>(deps, 'engines:refresh'),
  installEngine: (engineId: string) => call<EngineInfo>(deps, 'engines:install', engineId),
  openFiles: () => call<string[]>(deps, 'dialog:openFiles'),
  chooseDir: () => call<string | null>(deps, 'dialog:chooseDir'),
  chooseEngine: (engineId: string) => call<string | null>(deps, 'dialog:chooseEngine', engineId),
  expand: (paths: string[]) =>
    call<{ files: string[]; skipped: number; capped: boolean }>(deps, 'files:expand', paths),
  reveal: (path: string) => call<void>(deps, 'shell:reveal', path),
  openExternal: (url: string) => call<void>(deps, 'shell:openExternal', url),
  getSettings: () => call<Settings>(deps, 'settings:get'),
  setSettings: (patch: Partial<Settings>) => call<Settings>(deps, 'settings:set', patch),
  pathForFile: (file: File) => deps.pathForFile(file),
  on: <Event extends keyof PushEvents>(
    event: Event,
    listener: (data: PushEvents[Event]) => void,
  ): (() => void) => {
    if (!PUSH_CHANNELS.includes(event)) return () => undefined;
    return deps.subscribe(event, (data) => listener(data as PushEvents[Event]));
  },
});

export type FileconApi = ReturnType<typeof createApi>;
