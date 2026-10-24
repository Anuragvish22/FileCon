import type { CoreStatus, Job, RpcEvent, RpcMessage } from '@filecon/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/main/settings.ts';
import { createSupervisor, type CoreProcess } from '../../src/main/supervisor.ts';

/** A fake host: records what main sends, and lets the test play the host's side. */
const fakeProcess = () => {
  const sent: RpcMessage[] = [];
  const kill = vi.fn<() => void>();
  let message: (data: unknown) => void = () => undefined;
  let exit: (code: number | null) => void = () => undefined;
  let output: (text: string) => void = () => undefined;
  const process: CoreProcess = {
    postMessage: (outgoing) => sent.push(outgoing),
    onMessage: (listener) => (message = listener),
    onExit: (listener) => (exit = listener),
    onOutput: (listener) => (output = listener),
    kill: () => kill(),
  };
  const requests = () => sent.filter((item) => item.kind === 'req');
  return {
    process,
    kill,
    sent,
    requests,
    event: (name: RpcEvent, data: unknown) => message({ kind: 'evt', name, data }),
    answer: (method: string, result: unknown = null) => {
      const request = requests().find((item) => item.method === method);
      if (request) message({ kind: 'res', id: request.id, ok: true, result });
    },
    fail: (method: string) => {
      const request = requests().find((item) => item.method === method);
      if (request)
        message({
          kind: 'res',
          id: request.id,
          ok: false,
          error: { code: 'INVALID_REQUEST', params: {} },
        });
    },
    crash: (code = 1) => exit(code),
    print: (text: string) => output(text),
  };
};

type Fake = ReturnType<typeof fakeProcess>;

const job = (id: string, state: Job['state']): Job => ({
  id,
  batchId: 'batch',
  kind: 'convert',
  inputs: ['/a.png'],
  target: 'jpg',
  state,
  progress: { unit: 0, total: 1, fraction: 0 },
  outputs: [],
  notes: [],
  createdAt: 1,
});

const setup = () => {
  const forks: Fake[] = [];
  const statuses: { status: CoreStatus; restarts: number }[] = [];
  const events: [RpcEvent, unknown][] = [];
  const logs: string[] = [];
  const supervisor = createSupervisor({
    fork: () => {
      const fake = fakeProcess();
      forks.push(fake);
      return fake.process;
    },
    settings: () => DEFAULT_SETTINGS,
    dataDir: '/data',
    onStatus: (update) => statuses.push(update),
    onEvent: (name, data) => events.push([name, data]),
    log: (level, message) => logs.push(`${level} ${message}`),
    now: () => Date.now(),
  });
  const latest = (): Fake => forks[forks.length - 1] as Fake;
  const ready = (): void => {
    latest().answer('init');
    latest().event('ready', { engines: [] });
  };
  const states = () => statuses.map((item) => item.status);
  return { supervisor, forks, statuses, events, logs, latest, ready, states };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('supervisor start', () => {
  it('forks, sends init with settings and data dir, and reaches ready', () => {
    const { supervisor, latest, ready, states } = setup();
    supervisor.start();
    expect(latest().requests()).toMatchObject([
      { method: 'init', params: { settings: DEFAULT_SETTINGS, dataDir: '/data' } },
    ]);
    expect(supervisor.status()).toBe('starting');
    ready();
    expect(supervisor.status()).toBe('ready');
    expect(states()).toEqual(['starting', 'ready']);
  });

  it('refuses calls with CORE_UNAVAILABLE until ready, then relays them', async () => {
    const { supervisor, latest, ready } = setup();
    supervisor.start();
    await expect(supervisor.call('engines.list', {})).rejects.toMatchObject({
      error: { code: 'CORE_UNAVAILABLE' },
    });
    ready();
    const call = supervisor.call('engines.list', {});
    latest().answer('engines.list', ['x']);
    await expect(call).resolves.toEqual(['x']);
  });

  it('forwards host events, and writes core log events and output to the log', () => {
    const { supervisor, latest, ready, events, logs } = setup();
    supervisor.start();
    ready();
    latest().event('log', { level: 'warn', msg: 'job failed: EMPTY_FILE {}' });
    latest().print('stderr line\n');
    expect(events.map(([name]) => name)).toEqual(['ready', 'log']);
    expect(logs).toContain('warn core: job failed: EMPTY_FILE {}');
    expect(logs).toContain('info core output: stderr line');
  });

  it('treats a failed init as a crash', async () => {
    const { supervisor, latest, states } = setup();
    supervisor.start();
    latest().fail('init');
    await vi.advanceTimersByTimeAsync(0);
    expect(states()).toEqual(['starting', 'restarting']);
    expect(supervisor.status()).toBe('restarting');
  });
});

describe('ready timeout', () => {
  it('kills the host and restarts when ready does not come within 15 s', async () => {
    const { supervisor, forks, states } = setup();
    supervisor.start();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(forks[0]?.kill).toHaveBeenCalledOnce();
    expect(states()).toEqual(['starting', 'restarting']);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(forks).toHaveLength(2);
  });

  it('does not fire once ready arrived in time', async () => {
    const { supervisor, ready, forks } = setup();
    supervisor.start();
    await vi.advanceTimersByTimeAsync(14_000);
    ready();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(forks).toHaveLength(1);
    expect(supervisor.status()).toBe('ready');
  });
});

describe('crash and restart (F12)', () => {
  it('rejects pending calls with CORE_CRASHED', async () => {
    const { supervisor, latest, ready } = setup();
    supervisor.start();
    ready();
    const call = supervisor.call('detect', { paths: [] });
    latest().crash();
    await expect(call).rejects.toMatchObject({ error: { code: 'CORE_CRASHED' } });
  });

  it('synthesizes failed updates for queued and running jobs only', () => {
    const { supervisor, latest, ready, events } = setup();
    supervisor.start();
    ready();
    latest().event('job.update', job('queued-job', 'queued'));
    latest().event('job.update', job('running-job', 'running'));
    latest().event('job.update', job('done-job', 'done'));
    events.length = 0;
    latest().crash();
    const synthesized = events.map(([, data]) => data as Job);
    expect(synthesized.map((item) => item.id).sort()).toEqual(['queued-job', 'running-job']);
    expect(synthesized.every((item) => item.state === 'failed')).toBe(true);
    expect(synthesized[0]?.error).toEqual({ code: 'CORE_CRASHED', params: {} });
    expect(synthesized[0]?.endedAt).toBeTypeOf('number');
  });

  it('a crash mid-batch fails every active job, then new calls work after the restart', async () => {
    const { supervisor, latest, ready, events, forks } = setup();
    supervisor.start();
    ready();
    for (const [id, state] of [
      ['one', 'running'],
      ['two', 'running'],
      ['three', 'queued'],
      ['four', 'done'],
    ] as const)
      latest().event('job.update', job(id, state));
    const inFlight = supervisor.call('submit', { requests: [] });
    events.length = 0;
    latest().crash();

    await expect(inFlight).rejects.toMatchObject({ error: { code: 'CORE_CRASHED' } });
    const failed = events.map(([, data]) => data as Job);
    expect(failed.map((item) => item.id).sort()).toEqual(['one', 'three', 'two']);
    expect(failed.every((item) => item.error?.code === 'CORE_CRASHED')).toBe(true);
    await expect(supervisor.call('detect', { paths: [] })).rejects.toMatchObject({
      error: { code: 'CORE_UNAVAILABLE' },
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(forks).toHaveLength(2);
    ready();
    const after = supervisor.call('detect', { paths: [] });
    latest().answer('detect', []);
    await expect(after).resolves.toEqual([]);
  });

  it('restarts after 1 s, then 2 s, and reports restarting then ready', async () => {
    const { supervisor, forks, latest, ready, statuses } = setup();
    supervisor.start();
    ready();
    latest().crash();
    expect(statuses.at(-1)).toEqual({ status: 'restarting', restarts: 1 });
    await vi.advanceTimersByTimeAsync(999);
    expect(forks).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(forks).toHaveLength(2);
    ready();
    expect(supervisor.status()).toBe('ready');

    latest().crash();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(forks).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(forks).toHaveLength(3);
  });

  it('gives up after 3 restarts in 60 s: unavailable, and calls fail fast', async () => {
    const { supervisor, forks, latest, ready, states } = setup();
    supervisor.start();
    ready();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      latest().crash();
      await vi.advanceTimersByTimeAsync(10_000);
      ready();
    }
    expect(forks).toHaveLength(4);
    latest().crash();
    expect(supervisor.status()).toBe('unavailable');
    expect(states().at(-1)).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(forks).toHaveLength(4);
    await expect(supervisor.call('engines.list', {})).rejects.toMatchObject({
      error: { code: 'CORE_UNAVAILABLE' },
    });
  });

  it('forgets restarts older than 60 s', async () => {
    const { supervisor, forks, latest, ready } = setup();
    supervisor.start();
    ready();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      latest().crash();
      await vi.advanceTimersByTimeAsync(10_000);
      ready();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    latest().crash();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(forks).toHaveLength(5);
  });

  it('ignores late events from a host that was already replaced', async () => {
    const { supervisor, forks, latest, ready, events } = setup();
    supervisor.start();
    ready();
    const old = latest();
    old.crash();
    await vi.advanceTimersByTimeAsync(1_000);
    events.length = 0;
    old.event('job.update', job('ghost', 'running'));
    old.crash();
    expect(events).toEqual([]);
    expect(forks).toHaveLength(2);
  });
});

describe('shutdown (F13)', () => {
  it('asks the host to shut down, then kills it, and does not restart', async () => {
    const { supervisor, forks, latest, ready } = setup();
    supervisor.start();
    ready();
    const done = supervisor.shutdown();
    latest().answer('shutdown');
    await done;
    expect(forks[0]?.kill).toHaveBeenCalledOnce();
    latest().crash();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(forks).toHaveLength(1);
  });

  it('does not restart when the host exits while shutdown is in flight', async () => {
    const { supervisor, forks, latest, ready } = setup();
    supervisor.start();
    ready();
    const done = supervisor.shutdown();
    latest().crash(0);
    latest().answer('shutdown');
    await done;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(forks).toHaveLength(1);
  });

  it('kills the host when it does not answer within 5 s', async () => {
    const { supervisor, latest, ready } = setup();
    supervisor.start();
    ready();
    let finished = false;
    void supervisor.shutdown().then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(finished).toBe(true);
    expect(latest().kill).toHaveBeenCalledOnce();
  });

  it('cancels a pending restart', async () => {
    const { supervisor, forks, latest, ready } = setup();
    supervisor.start();
    ready();
    latest().crash();
    await supervisor.shutdown();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(forks).toHaveLength(1);
  });
});
