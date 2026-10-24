import type {
  CoreStatus,
  Job,
  RpcEvent,
  RpcMessage,
  RpcMethod,
  Settings,
} from '@filecon/core/types';
import { isActive } from '@filecon/core/types';
import { CoreCallError, createCoreClient, type CoreClient } from './coreClient.ts';

/** The host process as the supervisor sees it. `index.ts` adapts `utilityProcess` to this. */
export interface CoreProcess {
  postMessage(message: RpcMessage): void;
  onMessage(listener: (message: unknown) => void): void;
  onExit(listener: (code: number | null) => void): void;
  /** stdout and stderr text, for the log file. */
  onOutput(listener: (text: string) => void): void;
  kill(): void;
}

export interface SupervisorDeps {
  fork(): CoreProcess;
  settings(): Settings;
  dataDir: string;
  onStatus(update: { status: CoreStatus; restarts: number }): void;
  /** Every host event, plus the `job.update` events the supervisor synthesizes after a crash. */
  onEvent(name: RpcEvent, data: unknown): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
  now(): number;
}

export interface Supervisor {
  start(): void;
  status(): CoreStatus;
  /** Rejects with CORE_UNAVAILABLE unless the host is ready. */
  call(method: RpcMethod, params: unknown): Promise<unknown>;
  /** F13: ask the host to clean up, kill it if it doesn't answer in time. Resolves when it's over. */
  shutdown(): Promise<void>;
}

// ARCHITECTURE section 12
const READY_TIMEOUT_MS = 15_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const RESTART_WINDOW_MS = 60_000;
const MAX_RESTARTS_IN_WINDOW = 3;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_FACTOR = 2;

export const createSupervisor = (deps: SupervisorDeps): Supervisor => {
  let status: CoreStatus = 'starting';
  let restarts = 0; // total, shown in the banner
  let recentRestarts: number[] = []; // times, for the budget
  let quitting = false;
  let generation = 0; // a late event from a dead host must not affect the new one
  let current: { process: CoreProcess; client: CoreClient; exited: boolean } | undefined;
  let readyTimer: NodeJS.Timeout | undefined;
  let restartTimer: NodeJS.Timeout | undefined;
  const lastJobs = new Map<string, Job>();

  const setStatus = (next: CoreStatus): void => {
    status = next;
    deps.onStatus({ status, restarts });
  };

  const crashed = (reason: string): void => {
    clearTimeout(readyTimer);
    const host = current;
    current = undefined;
    generation += 1;
    if (host !== undefined && !host.exited) host.process.kill();
    host?.client.rejectAll({ code: 'CORE_CRASHED', params: {} });
    deps.log('error', `core host lost: ${reason}`);

    for (const job of lastJobs.values()) {
      if (!isActive(job.state)) continue;
      const failed: Job = {
        ...job,
        state: 'failed',
        error: { code: 'CORE_CRASHED', params: {} },
        endedAt: deps.now(),
      };
      deps.onEvent('job.update', failed);
    }
    lastJobs.clear();
    if (quitting) return;

    const now = deps.now();
    recentRestarts = recentRestarts.filter((time) => now - time < RESTART_WINDOW_MS);
    if (recentRestarts.length >= MAX_RESTARTS_IN_WINDOW) {
      deps.log('error', 'restart budget exhausted, core is unavailable until the app restarts');
      setStatus('unavailable');
      return;
    }
    const wait = BACKOFF_BASE_MS * BACKOFF_FACTOR ** recentRestarts.length;
    recentRestarts.push(now);
    restarts += 1;
    setStatus('restarting');
    restartTimer = setTimeout(launch, wait);
  };

  const launch = (): void => {
    restartTimer = undefined;
    const mine = ++generation;
    const process = deps.fork();
    const client = createCoreClient({ send: (message) => process.postMessage(message) });
    const host = { process, client, exited: false };
    current = host;

    client.onEvent((name, data) => {
      if (mine !== generation) return;
      if (name === 'ready') {
        clearTimeout(readyTimer);
        setStatus('ready');
      } else if (name === 'job.update') {
        const job = data as Job;
        lastJobs.set(job.id, job);
      } else if (name === 'log') {
        const entry = data as { level: 'debug' | 'info' | 'warn' | 'error'; msg: string };
        deps.log(entry.level === 'debug' ? 'info' : entry.level, `core: ${entry.msg}`);
      }
      deps.onEvent(name, data);
    });
    process.onMessage((message) => {
      if (mine === generation) client.receive(message);
    });
    process.onOutput((text) => {
      if (mine === generation) deps.log('info', `core output: ${text.trimEnd()}`);
    });
    process.onExit((code) => {
      host.exited = true;
      if (mine === generation) crashed(`exit code ${code ?? 'null'}`);
    });

    readyTimer = setTimeout(() => {
      if (mine === generation) crashed('no ready within 15 s');
    }, READY_TIMEOUT_MS);
    client
      .call('init', { settings: deps.settings(), dataDir: deps.dataDir })
      .catch((caught: unknown) => {
        if (mine === generation) crashed(`init failed: ${String(caught)}`);
      });
  };

  return {
    start() {
      setStatus('starting');
      launch();
    },

    status: () => status,

    call(method, params) {
      if (status !== 'ready' || current === undefined)
        return Promise.reject(new CoreCallError({ code: 'CORE_UNAVAILABLE', params: {} }));
      return current.client.call(method, params);
    },

    async shutdown() {
      quitting = true;
      clearTimeout(restartTimer);
      clearTimeout(readyTimer);
      const host = current;
      if (host === undefined) return;
      if (status === 'ready') {
        let timer: NodeJS.Timeout | undefined;
        const timedOut = new Promise<void>((resolve) => {
          timer = setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
        });
        await Promise.race([host.client.call('shutdown', {}).catch(() => undefined), timedOut]);
        clearTimeout(timer);
      }
      generation += 1; // the exit that follows is expected, not a crash
      current = undefined;
      if (!host.exited) host.process.kill();
    },
  };
};
