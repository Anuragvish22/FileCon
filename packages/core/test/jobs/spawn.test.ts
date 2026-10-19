import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createRunner, run, type RunRequest } from '../../src/jobs/spawn.ts';

const TIMEOUT_MS = 10_000;
const SHORT_TIMEOUT_MS = 300;
const FLOOD_BYTES = 1_000_000;
const TAIL_LIMIT = 2048;
const POLL_MS = 50;
const POLL_ATTEMPTS = 60;
const SLEEP_FOREVER = 'setInterval(() => {}, 1000)';

const node = (script: string, ...extra: string[]): RunRequest => ({
  bin: process.execPath,
  args: ['-e', script, ...extra],
  signal: new AbortController().signal,
  timeoutMs: TIMEOUT_MS,
});

const failureOf = async (
  request: RunRequest,
): Promise<{ error: { code: string }; detail?: string }> => {
  try {
    await run(request);
  } catch (caught) {
    return caught as { error: { code: string }; detail?: string };
  }
  throw new Error('expected run to reject');
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitUntilGone = async (pid: number): Promise<boolean> => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (!isAlive(pid)) return true;
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
  return false;
};

// Starts a child that starts a sleeping grandchild and prints the grandchild's pid.
const GRANDCHILD_SCRIPT = `
  const child = require('node:child_process').spawn(process.execPath, ['-e', '${SLEEP_FOREVER}'], { stdio: 'inherit' });
  console.log(child.pid);
  ${SLEEP_FOREVER};
`;

describe('spawn: happy path', () => {
  it('exit 0 resolves with the stdout and stderr tails', async () => {
    const result = await run(node('console.log("out"); console.error("err")'));
    expect(result).toEqual({ code: 0, stdoutTail: 'out\n', stderrTail: 'err\n' });
  });

  it('onStdout receives the output as it arrives', async () => {
    const chunks: string[] = [];
    await run({ ...node('console.log("progress 50")'), onStdout: (chunk) => chunks.push(chunk) });
    expect(chunks.join('')).toBe('progress 50\n');
  });
});

describe('spawn: must also pass', () => {
  it('a non-zero exit is ENGINE_FAILED with the stderr tail as detail', async () => {
    const failure = await failureOf(node('console.error("bad input"); process.exit(1)'));
    expect(failure.error).toMatchObject({ code: 'ENGINE_FAILED', params: { engine: 'node' } });
    expect(failure.error).toHaveProperty('detail', 'bad input\n');
  });

  it('a stderr flood is cut to the last 2 KB', async () => {
    const result = await run(node(`process.stderr.write('x'.repeat(${FLOOD_BYTES}) + 'END')`));
    expect(result.stderrTail.length).toBe(TAIL_LIMIT);
    expect(result.stderrTail.endsWith('xxEND')).toBe(true);
  });

  it('a timeout is TIMEOUT and the process is gone', async () => {
    const pidScript = `console.log(process.pid); ${SLEEP_FOREVER}`;
    let pid = 0;
    const failure = await failureOf({
      ...node(pidScript),
      timeoutMs: SHORT_TIMEOUT_MS,
      onStdout: (chunk) => {
        pid = Number(chunk);
      },
    });
    expect(failure.error.code).toBe('TIMEOUT');
    expect(await waitUntilGone(pid)).toBe(true);
  });

  it('an abort is CANCELLED', async () => {
    const controller = new AbortController();
    const pending = failureOf({
      ...node(SLEEP_FOREVER),
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), POLL_MS);
    expect((await pending).error.code).toBe('CANCELLED');
  });

  it('an already aborted signal is CANCELLED without starting anything', async () => {
    const failure = await failureOf({ ...node(SLEEP_FOREVER), signal: AbortSignal.abort() });
    expect(failure.error.code).toBe('CANCELLED');
  });

  it('abort kills a grandchild', async () => {
    const controller = new AbortController();
    let grandchildPid = 0;
    const pending = failureOf({
      ...node(GRANDCHILD_SCRIPT),
      signal: controller.signal,
      onStdout: (chunk) => {
        grandchildPid = Number(chunk);
        controller.abort();
      },
    });
    expect((await pending).error.code).toBe('CANCELLED');
    expect(grandchildPid).toBeGreaterThan(0);
    expect(await waitUntilGone(grandchildPid)).toBe(true);
  });

  it('an argument with spaces and quotes arrives intact', async () => {
    const tricky = `it's a "quoted"  name.png`;
    const result = await run(node('console.log(JSON.stringify(process.argv.slice(1)))', tricky));
    expect(JSON.parse(result.stdoutTail)).toEqual([tricky]);
  });

  it('shell metacharacters arrive as one literal string each', async () => {
    const hostile = ['; rm -rf x', '$(id)', '`id`', '&&', '| cat', '> out.txt'];
    const result = await run(
      node('console.log(JSON.stringify(process.argv.slice(1)))', ...hostile),
    );
    expect(JSON.parse(result.stdoutTail)).toEqual(hostile);
  });

  it('a binary that does not exist is ENGINE_FAILED', async () => {
    const failure = await failureOf({ ...node(''), bin: '/nonexistent/filecon-engine' });
    expect(failure.error).toMatchObject({
      code: 'ENGINE_FAILED',
      params: { engine: 'filecon-engine' },
    });
  });

  it('a string command or shell: true does not type-check', () => {
    // Never called: the point is that the compiler rejects both shapes.
    const typeOnly = (): void => {
      void run({
        bin: 'ls',
        // @ts-expect-error args must be an array
        args: 'ls -l; rm -rf x',
        signal: AbortSignal.abort(),
        timeoutMs: 1,
      });
      void run({
        bin: 'ls',
        args: [],
        signal: AbortSignal.abort(),
        timeoutMs: 1,
        // @ts-expect-error there is no shell option
        shell: true,
      });
    };
    expect(typeOnly).toBeTypeOf('function');
  });
});

describe('spawn: Windows branch', () => {
  it('kills the tree with taskkill and an argument array, not a process group', async () => {
    const calls: { bin: string; args: readonly string[]; options: SpawnOptions }[] = [];
    let engineChild: ChildProcess | undefined;
    const runner = createRunner({
      platform: 'win32',
      spawnFn: (bin, args, options) => {
        calls.push({ bin, args, options });
        if (bin === 'taskkill') {
          engineChild?.kill(); // stands in for what taskkill does on Windows
          return spawn(process.execPath, ['-e', '']);
        }
        engineChild = spawn(bin, [...args], options);
        return engineChild;
      },
    });

    const controller = new AbortController();
    const pending = runner({
      ...node(SLEEP_FOREVER),
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), POLL_MS);
    await expect(pending).rejects.toMatchObject({ error: { code: 'CANCELLED' } });

    const [engineCall, killCall] = calls;
    expect(engineCall?.options).toMatchObject({ shell: false, detached: false });
    expect(killCall).toMatchObject({
      bin: 'taskkill',
      args: ['/PID', String(engineChild?.pid), '/T', '/F'],
      options: { shell: false },
    });
  });
});
