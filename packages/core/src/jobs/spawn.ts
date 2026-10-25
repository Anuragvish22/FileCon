import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { basename, extname } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { CoreFailure } from '../errors.ts';

// ARCHITECTURE section 5. Every external engine starts here, never with a shell (TRD NFR-7).
const TAIL_BYTES = 2048;
const KILL_SIGNAL = 'SIGKILL';
const WINDOWS = 'win32';

export interface RunRequest {
  bin: string;
  args: readonly string[];
  signal: AbortSignal;
  timeoutMs: number;
  cwd?: string;
  env?: Record<string, string>; // added to this process's environment
  onStdout?: (chunk: string) => void;
}

export interface RunResult {
  code: number;
  stdoutTail: string;
  stderrTail: string;
}

/** The two things that differ per OS, injected so tests can cover the Windows branch on Linux. */
export interface SpawnDeps {
  platform: NodeJS.Platform;
  spawnFn: (bin: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
}

type StopReason = 'CANCELLED' | 'TIMEOUT';

const killTree = (deps: SpawnDeps, child: ChildProcess): void => {
  const { pid } = child;
  if (pid === undefined) return;
  try {
    if (deps.platform === WINDOWS) {
      deps.spawnFn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      });
    } else {
      // A negative pid signals the whole process group, which `detached` made for this child.
      process.kill(-pid, KILL_SIGNAL);
    }
  } catch {
    // Already gone: nothing left to kill.
  }
};

const keepTail = (tail: Buffer, chunk: Buffer): Buffer => {
  const joined = Buffer.concat([tail, chunk]);
  return joined.length > TAIL_BYTES ? joined.subarray(-TAIL_BYTES) : joined;
};

export const createSpawn =
  (deps: SpawnDeps) =>
  ({ bin, args, signal, timeoutMs, cwd, env, onStdout }: RunRequest): Promise<RunResult> =>
    new Promise((resolve, reject) => {
      const engine = basename(bin, extname(bin)); // `node.exe` and `node` are one engine id
      if (signal.aborted) {
        reject(new CoreFailure('CANCELLED', { engine }));
        return;
      }

      const child = deps.spawnFn(bin, args, {
        shell: false,
        detached: deps.platform !== WINDOWS,
        windowsHide: true,
        cwd,
        env: env === undefined ? undefined : { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutTail: Buffer = Buffer.alloc(0);
      let stderrTail: Buffer = Buffer.alloc(0);
      const decoder = new StringDecoder('utf8');
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutTail = keepTail(stdoutTail, chunk);
        onStdout?.(decoder.write(chunk));
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrTail = keepTail(stderrTail, chunk);
      });

      let stopReason: StopReason | undefined;
      let settled = false;
      const stop = (reason: StopReason): void => {
        if (stopReason !== undefined) return;
        stopReason = reason;
        killTree(deps, child);
      };
      const timer = setTimeout(() => stop('TIMEOUT'), timeoutMs);
      const onAbort = (): void => stop('CANCELLED');
      signal.addEventListener('abort', onAbort, { once: true });

      const finish = (settle: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        settle();
      };

      // ENOENT, EACCES: the process never started, so there is no 'close'.
      child.on('error', (cause) =>
        finish(() => reject(new CoreFailure('ENGINE_FAILED', { engine }, cause.message))),
      );
      // 'close', not 'exit': stdio is drained by then, so the tails are complete.
      child.on('close', (code) =>
        finish(() => {
          const detail = stderrTail.toString('utf8');
          if (stopReason !== undefined) reject(new CoreFailure(stopReason, { engine }, detail));
          else if (code === 0)
            resolve({ code, stdoutTail: stdoutTail.toString('utf8'), stderrTail: detail });
          else reject(new CoreFailure('ENGINE_FAILED', { engine }, detail));
        }),
      );
    });

export const run = createSpawn({ platform: process.platform, spawnFn: spawn });
