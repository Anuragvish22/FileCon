import { availableParallelism } from 'node:os';
import { dirname } from 'node:path';
import { detect } from '../detect.ts';
import { CoreFailure, toCoreError } from '../errors.ts';
import { buildGraph, route, targets, type Graph } from '../graph/index.ts';
import { createRunner, type Runner } from '../jobs/runner.ts';
import { createScheduler, type Scheduler } from '../jobs/scheduler.ts';
import { sweep } from '../jobs/tmp.ts';
import type { Registry } from '../registry.ts';
import type {
  DetectResult,
  EngineInfo,
  Job,
  JobRequest,
  Route,
  RpcEvent,
  RpcMessage,
  Settings,
  SubmitResult,
  TargetsResult,
} from '../types/index.ts';
import { failResponse, isRpcMethod, okResponse, PARAMS, parseRequest } from './protocol.ts';

// FLOWS F1 (startup), F11 (settings), F13 (quit).
const DAY_MS = 86_400_000; // leftover temp dirs older than this are removed at init
const CPU_RESERVE = 1; // "auto" concurrency leaves one core for the app itself
const TERMINAL_STATES: readonly Job['state'][] = ['done', 'failed', 'cancelled'];

export interface RegistryInput {
  dataDir: string;
  /** The path discovery found for an engine, or undefined when it isn't installed. Read at call time. */
  enginePath: (engineId: string) => string | undefined;
}

export interface ServerDeps {
  send(message: RpcMessage): void;
  createRegistry(input: RegistryInput): Registry;
  discover(overrides: Readonly<Record<string, string>>): Promise<EngineInfo[]>;
  /** Called after the `shutdown` reply is sent: the host process exits here. */
  onClosed?: () => void;
}

export interface Server {
  handle(message: unknown): void;
}

type Phase = 'idle' | 'initializing' | 'ready' | 'closed';

interface Session {
  settings: Settings;
  graphs: { available: Graph; full: Graph };
  registry: Registry;
  scheduler: Scheduler;
  runner: Runner;
}

const slotCount = (settings: Settings): number =>
  settings.concurrency === 'auto'
    ? Math.max(1, availableParallelism() - CPU_RESERVE)
    : settings.concurrency;

const enginesChanged = (before: Settings, after: Settings): boolean =>
  JSON.stringify([before.engines.paths, before.engines.priority]) !==
  JSON.stringify([after.engines.paths, after.engines.priority]);

export const createServer = (deps: ServerDeps): Server => {
  let phase: Phase = 'idle';
  let session: Session | undefined;
  let engines: EngineInfo[] = []; // replaced by every re-probe; the registry reads it at call time
  const activeJobs = new Set<string>();
  let drainWaiters: (() => void)[] = [];

  const emit = (name: RpcEvent, data: unknown): void => deps.send({ kind: 'evt', name, data });

  // Codes and params only, never prose (CONTRACTS section 5). Main writes these to the log file.
  const log = (level: 'info' | 'warn', msg: string, jobId?: string): void =>
    emit('log', jobId === undefined ? { level, msg } : { level, msg, jobId });

  // Only called once `init` has finished, so the session exists.
  const live = (): Session => {
    if (session === undefined) throw new CoreFailure('CORE_UNAVAILABLE');
    return session;
  };

  const buildGraphs = async (
    registry: Registry,
    priority: readonly string[],
  ): Promise<Session['graphs']> => {
    const converters = registry.converters();
    const usable = await Promise.all(converters.map((converter) => converter.available()));
    const availableIds = new Set(
      converters
        .filter((converter, index) => usable[index] === true)
        .map((converter) => converter.id),
    );
    const everyId = new Set(converters.map((converter) => converter.id));
    return {
      available: buildGraph({ registry, availableIds, priority }),
      full: buildGraph({ registry, availableIds: everyId, priority }),
    };
  };

  const reprobe = async (current: Session): Promise<void> => {
    engines = await deps.discover(current.settings.engines.paths);
    current.graphs = await buildGraphs(current.registry, current.settings.engines.priority);
    emit('engines.changed', engines);
    const found = engines.filter((engine) => engine.found).map((engine) => engine.id);
    log('info', `engines re-probed, found: ${found.join(',') || 'none'}`);
  };

  const outDirOf = (settings: Settings, request: JobRequest): string => {
    if (request.outDir !== undefined) return request.outDir;
    if (settings.output.mode === 'custom' && settings.output.dir !== undefined)
      return settings.output.dir;
    const [firstInput] = request.kind === 'merge' ? request.inputs : [request.input];
    return dirname(firstInput ?? '');
  };

  const trackJob = (job: Job): void => {
    if (TERMINAL_STATES.includes(job.state)) activeJobs.delete(job.id);
    else activeJobs.add(job.id);
    emit('job.update', job);
    if (job.state === 'failed' && job.error !== undefined)
      log('warn', `job failed: ${job.error.code} ${JSON.stringify(job.error.params)}`, job.id);
    if (activeJobs.size === 0) {
      const waiters = drainWaiters;
      drainWaiters = [];
      for (const wake of waiters) wake();
    }
  };

  const allJobsEnded = (): Promise<void> =>
    activeJobs.size === 0 ? Promise.resolve() : new Promise((wake) => drainWaiters.push(wake));

  const init = async (params: unknown): Promise<void> => {
    const { settings, dataDir } = PARAMS.init(params);
    if (phase !== 'idle') throw new CoreFailure('INVALID_REQUEST');
    phase = 'initializing';
    try {
      await sweep(DAY_MS);
      const registry = deps.createRegistry({
        dataDir,
        enginePath: (engineId) =>
          engines.find((engine) => engine.id === engineId && engine.found)?.path,
      });
      engines = await deps.discover(settings.engines.paths);
      const scheduler = createScheduler(slotCount(settings));
      session = {
        settings,
        graphs: await buildGraphs(registry, settings.engines.priority),
        registry,
        scheduler,
        runner: createRunner({
          registry,
          graphs: () => live().graphs,
          scheduler,
          resolveOutDir: (request) => outDirOf(live().settings, request),
        }),
      };
      session.runner.on('update', trackJob);
    } catch (caught) {
      phase = 'idle';
      throw caught;
    }
    phase = 'ready';
    emit('ready', { engines });
  };

  const handlers: Record<string, (params: unknown) => unknown> = {
    init,
    detect: async (params) => {
      const results: DetectResult[] = [];
      // One file at a time: a drop of thousands must not open thousands of files at once.
      for (const path of PARAMS.detect(params).paths) results.push(await detect(path));
      return results;
    },
    targets: (params): TargetsResult =>
      targets({ ...live().graphs, formats: PARAMS.targets(params).formats }),
    plan: (params): Route | null => {
      const { from, to } = PARAMS.plan(params);
      return route(live().graphs.available, from, to);
    },
    submit: (params): SubmitResult => live().runner.submit(PARAMS.submit(params).requests),
    cancel: (params): void => live().runner.cancel(PARAMS.cancel(params).jobId),
    cancelAll: (params): void => {
      PARAMS.empty(params);
      live().runner.cancelAll();
    },
    'engines.list': (params): EngineInfo[] => {
      PARAMS.empty(params);
      return engines;
    },
    'engines.refresh': async (params): Promise<EngineInfo[]> => {
      PARAMS.empty(params);
      await reprobe(live());
      return engines;
    },
    // shortcut: no engine has a download install yet, so every id is refused; real installs arrive with M1.1-4
    'engines.install': (params): never => {
      PARAMS.engineInstall(params);
      throw new CoreFailure('INVALID_REQUEST');
    },
    'settings.apply': async (params): Promise<void> => {
      const { settings } = PARAMS.settingsApply(params);
      const current = live();
      const probeNeeded = enginesChanged(current.settings, settings);
      current.settings = settings;
      current.scheduler.setConcurrency(slotCount(settings));
      if (probeNeeded) await reprobe(current);
    },
    shutdown: async (params): Promise<void> => {
      PARAMS.empty(params);
      phase = 'closed';
      session?.runner.cancelAll();
      await allJobsEnded();
    },
  };

  const respond = async (id: number, method: unknown, params: unknown): Promise<void> => {
    try {
      if (!isRpcMethod(method)) throw new CoreFailure('INVALID_REQUEST');
      const lifecycle = method === 'init' || method === 'shutdown';
      if (phase !== 'ready' && !lifecycle) throw new CoreFailure('CORE_UNAVAILABLE');
      const handler = handlers[method];
      if (handler === undefined) throw new CoreFailure('INVALID_REQUEST');
      deps.send(okResponse(id, (await handler(params)) ?? null));
      if (method === 'shutdown') deps.onClosed?.();
    } catch (caught) {
      deps.send(failResponse(id, toCoreError(caught)));
    }
  };

  return {
    handle(message) {
      const request = parseRequest(message);
      if (request !== null) void respond(request.id, request.method, request.params);
    },
  };
};
