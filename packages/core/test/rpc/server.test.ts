import { stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';
import { fileTypeFromFile } from 'file-type';
import { describe, expect, it } from 'vitest';
import { CoreFailure } from '../../src/errors.ts';
import { createProductionRegistry } from '../../src/host.ts';
import { discoverAll } from '../../src/engines/discovery.ts';
import { ENGINE_SPECS } from '../../src/engines/specs.ts';
import type { Registry } from '../../src/registry.ts';
import { createServer } from '../../src/rpc/server.ts';
import type {
  DetectResult,
  EngineInfo,
  Job,
  RpcMessage,
  RpcMethod,
  Settings,
  SubmitResult,
  TargetsResult,
} from '../../src/types/index.ts';
import { fakeConverter, registryOf } from '../fakes.ts';
import { NO_OPTIONS, source, useWorkDir, workDirPath } from '../harness.ts';

const SETTINGS: Settings = {
  version: 1,
  output: { mode: 'source' },
  concurrency: 2,
  engines: { paths: {}, priority: [] },
  ui: { theme: 'system', accent: 'blue', language: 'en' },
};

const discoverReal = (overrides: Readonly<Record<string, string>>): Promise<EngineInfo[]> =>
  discoverAll({ specs: ENGINE_SPECS, overrides });

type Response = Extract<RpcMessage, { kind: 'res' }>;
type Event = Extract<RpcMessage, { kind: 'evt' }>;

interface StartOptions {
  createRegistry?: () => Registry;
  discover?: (overrides: Readonly<Record<string, string>>) => Promise<EngineInfo[]>;
}

/** A server wired to a client over a MessageChannel, like the real host and main. */
const start = ({ createRegistry, discover = discoverReal }: StartOptions = {}) => {
  const { port1: clientPort, port2: serverPort } = new MessageChannel();
  const events: Event[] = [];
  const waiters = new Map<number, (response: Response) => void>();
  let closed = false;
  let nextId = 1;

  const server = createServer({
    send: (message) => serverPort.postMessage(message),
    createRegistry: createRegistry ?? ((input) => createProductionRegistry(input)),
    discover,
    onClosed: () => {
      closed = true;
    },
  });
  serverPort.on('message', (message: unknown) => server.handle(message));
  clientPort.on('message', (message: RpcMessage) => {
    if (message.kind === 'evt') events.push(message);
    else if (message.kind === 'res') waiters.get(message.id)?.(message);
  });

  const call = (method: string, params: unknown = {}): Promise<Response> =>
    new Promise((resolve) => {
      const id = nextId++;
      waiters.set(id, resolve);
      clientPort.postMessage({ kind: 'req', id, method: method as RpcMethod, params });
    });
  const result = async <Result>(method: string, params?: unknown): Promise<Result> => {
    const response = await call(method, params);
    if (!response.ok) throw new Error(`${method} failed: ${response.error.code}`);
    return response.result as Result;
  };
  const eventsNamed = (name: string): Event[] => events.filter((event) => event.name === name);
  const jobUpdates = (jobId: string): Job[] =>
    eventsNamed('job.update')
      .map((event) => event.data as Job)
      .filter((job) => job.id === jobId);
  const until = async (done: () => boolean): Promise<void> => {
    const deadline = Date.now() + 30_000;
    while (!done()) {
      if (Date.now() > deadline) throw new Error('timed out waiting');
      await new Promise((resume) => setTimeout(resume, 10));
    }
  };
  const finished = async (jobId: string): Promise<Job> => {
    await until(() =>
      ['done', 'failed', 'cancelled'].includes(jobUpdates(jobId).at(-1)?.state ?? ''),
    );
    return jobUpdates(jobId).at(-1) as Job;
  };
  const init = (settings: Settings = SETTINGS) =>
    result('init', { settings, dataDir: workDirPath() });
  const stop = (): void => {
    clientPort.close();
    serverPort.close();
  };
  return {
    call,
    result,
    events,
    eventsNamed,
    jobUpdates,
    finished,
    until,
    init,
    stop,
    server,
    isClosed: () => closed,
  };
};

const errorCodeOf = (response: Response): string | undefined =>
  response.ok ? undefined : response.error.code;

const libreOfficeFound = (await discoverReal({})).find(
  (engine) => engine.id === 'libreoffice',
)?.found;

describe('rpc server', () => {
  useWorkDir();

  describe('happy path', () => {
    it('init discovers engines and emits ready', async () => {
      const host = start();
      await host.init();
      const [ready] = host.eventsNamed('ready');
      const engines = (ready?.data as { engines: EngineInfo[] }).engines;
      expect(engines.find((engine) => engine.id === 'sharp')?.found).toBe(true);
      host.stop();
    });

    it('detect keeps the order, and a missing file is a result, not a rejection', async () => {
      const host = start();
      await host.init();
      const png = await source('png', 'sample.png');
      const results = await host.result<DetectResult[]>('detect', {
        paths: [`${png}.missing`, png],
      });
      expect(results.map((entry) => entry.path)).toEqual([`${png}.missing`, png]);
      expect(results[0]?.error?.code).toBe('INPUT_NOT_FOUND');
      expect(results[1]?.format).toBe('png');
      host.stop();
    });

    it('targets and plan use the real converters', async () => {
      const host = start();
      await host.init();
      const found = await host.result<TargetsResult>('targets', { formats: ['png'] });
      expect(found.convert.find((option) => option.format === 'jpg')?.status).toBe('ready');
      const planned = await host.result<{ steps: { converterId: string }[] } | null>('plan', {
        from: 'png',
        to: 'jpg',
      });
      expect(planned?.steps.map((step) => step.converterId)).toEqual(['sharp']);
      expect(await host.result('plan', { from: 'png', to: 'docx' })).toBeNull();
      host.stop();
    });

    it('converts png to jpg with sharp, and relays the job updates', async () => {
      const host = start();
      await host.init();
      const png = await source('png', 'sample.png');
      const { jobIds } = await host.result<SubmitResult>('submit', {
        requests: [{ kind: 'convert', input: png, target: 'jpg', options: NO_OPTIONS }],
      });
      const job = await host.finished(jobIds[0] ?? '');
      expect(job.state).toBe('done');
      expect((await fileTypeFromFile(job.outputs[0] ?? ''))?.ext).toBe('jpg');
      expect(host.jobUpdates(job.id).map((update) => update.state)).toContain('queued');
      host.stop();
    });

    it('converts png to pdf, then merges two pdfs', async () => {
      const host = start();
      await host.init();
      const png = await source('png', 'sample.png');
      const first = await source('pdf', 'sample.pdf');
      const second = await source('pdf', 'sample.pdf');
      const { jobIds } = await host.result<SubmitResult>('submit', {
        requests: [
          { kind: 'convert', input: png, target: 'pdf', options: NO_OPTIONS },
          { kind: 'merge', inputs: [first, second], combinerId: 'merge-pdf', options: NO_OPTIONS },
        ],
      });
      for (const jobId of jobIds) {
        const job = await host.finished(jobId);
        expect(job.state).toBe('done');
        expect((await fileTypeFromFile(job.outputs[0] ?? ''))?.ext).toBe('pdf');
      }
      host.stop();
    });

    it.skipIf(!libreOfficeFound)('converts docx to pdf with LibreOffice', async () => {
      const host = start();
      await host.init();
      const docx = await source('docx', 'report.docx');
      const { jobIds } = await host.result<SubmitResult>('submit', {
        requests: [{ kind: 'convert', input: docx, target: 'pdf', options: NO_OPTIONS }],
      });
      const job = await host.finished(jobIds[0] ?? '');
      expect(job.state).toBe('done');
      expect((await fileTypeFromFile(job.outputs[0] ?? ''))?.ext).toBe('pdf');
      host.stop();
    });

    it('engines.list returns the discovered engines, refresh re-probes and emits engines.changed', async () => {
      const host = start();
      await host.init();
      const listed = await host.result<EngineInfo[]>('engines.list');
      const refreshed = await host.result<EngineInfo[]>('engines.refresh');
      expect(refreshed.map((engine) => engine.id)).toEqual(listed.map((engine) => engine.id));
      expect(host.eventsNamed('engines.changed')).toHaveLength(1);
      host.stop();
    });

    it('logs a re-probe and a failed job as codes, with the job id (P28)', async () => {
      const host = start();
      await host.init();
      await host.result('engines.refresh');
      const empty = join(workDirPath(), 'empty.png');
      await writeFile(empty, '');
      const { jobIds } = await host.result<SubmitResult>('submit', {
        requests: [{ kind: 'convert', input: empty, target: 'jpg', options: NO_OPTIONS }],
      });
      const job = await host.finished(jobIds[0] ?? '');
      expect(job.state).toBe('failed');
      const logs = host.eventsNamed('log').map((event) => event.data);
      expect(logs).toContainEqual({
        level: 'info',
        msg: expect.stringContaining('re-probed') as string,
      });
      expect(logs).toContainEqual({
        level: 'warn',
        msg: 'job failed: EMPTY_FILE {"name":"empty.png"}',
        jobId: job.id,
      });
      host.stop();
    });

    it('settings.apply re-probes only when engine paths or priority changed', async () => {
      const host = start();
      await host.init();
      await host.result('settings.apply', { settings: { ...SETTINGS, concurrency: 4 } });
      expect(host.eventsNamed('engines.changed')).toHaveLength(0);
      await host.result('settings.apply', {
        settings: { ...SETTINGS, engines: { paths: {}, priority: ['sharp'] } },
      });
      expect(host.eventsNamed('engines.changed')).toHaveLength(1);
      host.stop();
    });

    it('cancel of an unknown job and cancelAll with nothing running are no-ops', async () => {
      const host = start();
      await host.init();
      expect((await host.call('cancel', { jobId: 'nope' })).ok).toBe(true);
      expect((await host.call('cancelAll', {})).ok).toBe(true);
      host.stop();
    });
  });

  describe('must also pass', () => {
    it('answers CORE_UNAVAILABLE before init, but still allows init and shutdown', async () => {
      const host = start();
      for (const method of ['detect', 'targets', 'plan', 'submit', 'cancel', 'engines.list'])
        expect(errorCodeOf(await host.call(method, {}))).toBe('CORE_UNAVAILABLE');
      expect((await host.call('shutdown')).ok).toBe(true);
      host.stop();
    });

    it('answers CORE_UNAVAILABLE while init is still running', async () => {
      let release: (engines: EngineInfo[]) => void = () => undefined;
      let discovering = false;
      const host = start({
        discover: () =>
          new Promise((resolve) => {
            discovering = true;
            release = resolve;
          }),
      });
      const starting = host.init();
      await host.until(() => discovering);
      expect(errorCodeOf(await host.call('engines.list'))).toBe('CORE_UNAVAILABLE');
      release([]);
      await starting;
      host.stop();
    });

    it('refuses a second init', async () => {
      const host = start();
      await host.init();
      const again = await host.call('init', { settings: SETTINGS, dataDir: workDirPath() });
      expect(errorCodeOf(again)).toBe('INVALID_REQUEST');
      host.stop();
    });

    it('answers INVALID_REQUEST for an unknown method, ready or not', async () => {
      const host = start();
      expect(errorCodeOf(await host.call('nope'))).toBe('INVALID_REQUEST');
      await host.init();
      expect(errorCodeOf(await host.call('nope'))).toBe('INVALID_REQUEST');
      host.stop();
    });

    it('ignores a message that is not a request, so there is nothing to answer', () => {
      const host = start();
      expect(() => {
        host.server.handle('garbage');
        host.server.handle({ kind: 'req', method: 'init' });
        host.server.handle(null);
      }).not.toThrow();
      host.stop();
    });

    const MALFORMED: [string, unknown][] = [
      ['init', { settings: SETTINGS }],
      ['init', { settings: { ...SETTINGS, concurrency: 99 }, dataDir: 'x' }],
      ['init', { settings: { ...SETTINGS, output: { mode: 'custom' } }, dataDir: 'x' }],
      ['detect', { paths: 'a.png' }],
      ['detect', { paths: [1] }],
      ['targets', { formats: ['not-a-format'] }],
      ['targets', null],
      ['plan', { from: 'png' }],
      ['submit', { requests: 'x' }],
      ['submit', { requests: [{ kind: 'convert', input: 'a.png', target: 'jpg' }] }],
      ['cancel', { jobId: 5 }],
      ['engines.install', {}],
      ['settings.apply', { settings: { version: 2 } }],
    ];
    it.each(MALFORMED)('%s with malformed params gives INVALID_REQUEST', async (method, params) => {
      const host = start();
      if (method !== 'init') await host.init();
      expect(errorCodeOf(await host.call(method, params))).toBe('INVALID_REQUEST');
      host.stop();
    });

    it('engines.install is refused while no engine has a download install', async () => {
      const host = start();
      await host.init();
      const response = await host.call('engines.install', { engineId: 'libreoffice' });
      expect(errorCodeOf(response)).toBe('INVALID_REQUEST');
      host.stop();
    });

    describe('submit is all or nothing', () => {
      const bad: [string, unknown][] = [
        [
          'a bad option range',
          { kind: 'convert', input: '/x/a.png', target: 'jpg', options: { quality: 500 } },
        ],
        [
          'an unknown combiner',
          { kind: 'merge', inputs: ['/x/a.pdf'], combinerId: 'nope', options: {} },
        ],
        [
          'an extract request (not built yet)',
          { kind: 'extract', input: '/x/a.pdf', extractorId: 'x', options: {} },
        ],
      ];
      it.each(bad)('%s rejects the whole call and queues nothing', async (_label, request) => {
        const host = start();
        await host.init();
        const png = await source('png', 'sample.png');
        const good = { kind: 'convert', input: png, target: 'jpg', options: NO_OPTIONS };
        const response = await host.call('submit', { requests: [good, request] });
        expect(errorCodeOf(response)).toBe('INVALID_REQUEST');
        await new Promise((resume) => setTimeout(resume, 50));
        expect(host.eventsNamed('job.update')).toHaveLength(0);
        host.stop();
      });
    });

    it('answers out of order: a fast call is not held up by a slow one', async () => {
      let release: (engines: EngineInfo[]) => void = () => undefined;
      let calls = 0;
      const host = start({
        discover: (overrides) => {
          calls += 1;
          return calls === 1
            ? discoverReal(overrides)
            : new Promise((resolve) => (release = resolve));
        },
      });
      await host.init();
      const slow = host.call('engines.refresh');
      const fast = await host.call('engines.list');
      expect(fast.ok).toBe(true);
      expect(host.eventsNamed('engines.changed')).toHaveLength(0);
      release([]);
      expect((await slow).ok).toBe(true);
      host.stop();
    });

    it('shutdown cancels a running job, removes its temp dir and then closes', async () => {
      let tmpDir = '';
      let started = false;
      const blocker = fakeConverter({
        id: 'blocker',
        edges: [{ from: 'png', to: 'jpg', cost: 1 }],
        convert: (_req, ctx) =>
          new Promise((_resolve, reject) => {
            tmpDir = ctx.tmpDir;
            started = true;
            ctx.signal.addEventListener('abort', () => reject(new CoreFailure('CANCELLED')));
          }),
      });
      const host = start({ createRegistry: () => registryOf(blocker) });
      await host.init();
      const png = await source('png', 'sample.png');
      const { jobIds } = await host.result<SubmitResult>('submit', {
        requests: [{ kind: 'convert', input: png, target: 'jpg', options: NO_OPTIONS }],
      });
      await host.until(() => started);
      expect((await host.call('shutdown')).ok).toBe(true);
      expect(host.jobUpdates(jobIds[0] ?? '').at(-1)?.state).toBe('cancelled');
      await expect(stat(tmpDir)).rejects.toThrow();
      expect(host.isClosed()).toBe(true);
      expect(errorCodeOf(await host.call('engines.list'))).toBe('CORE_UNAVAILABLE');
      host.stop();
    });
  });
});
