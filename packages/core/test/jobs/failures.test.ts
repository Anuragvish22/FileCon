import { chmod, mkdir, readdir, readFile, symlink, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../../src/jobs/spawn.ts';
import type { CoreError, Job, JobRequest } from '../../src/types/index.ts';
import { fakeConverter, writeOutput } from '../fakes.ts';
import {
  convertRequest,
  edge,
  expectNoTmp,
  harness,
  sleep,
  source,
  useWorkDir,
  workDirPath,
  writeSource,
} from '../harness.ts';

// FLOWS F8 and F9: every fault ends with no temp dir, no child process, no partial output and an
// untouched source. Each row is one fault in one state of the job.
useWorkDir();

const ENGINE_TIMEOUT_MS = 400;
// Starting a node child and killing its tree takes several seconds on Windows runners.
const SLOW_PROCESS_TIMEOUT_MS = 30_000;
const ENGINE_BIN = process.execPath;
const CHILD_START_TIMEOUT_MS = 5_000;
const BATCH = 5;
const READ_ONLY = 0o555;
const NO_ACCESS = 0o000;
const ALL_ACCESS = 0o755;
// root ignores file modes, and chmod does not remove access on Windows
const isRoot = process.getuid?.() === 0 || process.platform === 'win32';

const aliveAfter = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitForFile = async (path: string): Promise<string> => {
  const deadline = Date.now() + CHILD_START_TIMEOUT_MS;
  for (;;) {
    try {
      return await readFile(path, 'utf8');
    } catch (caught) {
      if (Date.now() > deadline) throw caught;
      await sleep(10);
    }
  }
};

/** An engine that is a real child process, so "no child process left" can be checked. */
const childEngine = (script: string, pidFile?: string) =>
  fakeConverter({
    id: 'child',
    edges: [edge('jpg', 'png')],
    timeoutMs: ENGINE_TIMEOUT_MS,
    convert: async (req, ctx) => {
      await run({
        bin: ENGINE_BIN,
        args: ['-e', script, pidFile ?? ''],
        signal: ctx.signal,
        timeoutMs: ENGINE_TIMEOUT_MS * 10,
        cwd: req.outDir,
      });
      return writeOutput(req);
    },
  });

const WRITE_PID = "require('fs').writeFileSync(process.argv[1], String(process.pid));";

interface Row {
  fault: string;
  arrange: () => Promise<{
    converters: ReturnType<typeof fakeConverter>[];
    input: string;
    resolveOutDir?: (outDir: string) => string;
    after?: () => Promise<void>;
  }>;
  expected: { state: Job['state']; error?: Partial<CoreError> };
  skip?: boolean;
}

const stuckPidFile = (): string =>
  join(workDirPath(), `pid-${Math.random().toString(36).slice(2)}`);

const rows: Row[] = [
  {
    fault: 'the engine exits non-zero',
    arrange: async () => ({
      converters: [childEngine("console.error('boom'); process.exit(3);")],
      input: await source('jpg', 'sample.jpg', 'a.jpg'),
    }),
    expected: { state: 'failed', error: { code: 'ENGINE_FAILED' } },
  },
  {
    fault: 'the engine hangs past its timeout',
    arrange: async () => {
      const pidFile = stuckPidFile();
      return {
        converters: [childEngine(`${WRITE_PID} setInterval(() => {}, 1000);`, pidFile)],
        input: await source('jpg', 'sample.jpg', 'a.jpg'),
        after: async () => {
          const pid = Number(await waitForFile(pidFile));
          await sleep(ENGINE_TIMEOUT_MS / 4);
          expect(aliveAfter(pid)).toBe(false);
        },
      };
    },
    expected: { state: 'failed', error: { code: 'TIMEOUT', params: { engine: 'child' } } },
  },
  {
    fault: 'the input was deleted after it was detected',
    arrange: async () => {
      const input = await source('jpg', 'sample.jpg', 'gone.jpg');
      await unlink(input);
      return { converters: [childEngine('')], input };
    },
    expected: { state: 'failed', error: { code: 'INPUT_NOT_FOUND' } },
  },
  {
    fault: 'the input was made unreadable after it was detected',
    skip: isRoot,
    arrange: async () => {
      const input = await source('jpg', 'sample.jpg', 'locked.jpg');
      await chmod(input, NO_ACCESS);
      return {
        converters: [childEngine('')],
        input,
        after: () => chmod(input, ALL_ACCESS),
      };
    },
    expected: { state: 'failed', error: { code: 'INPUT_UNREADABLE' } },
  },
  {
    fault: 'the output folder is read-only',
    skip: isRoot,
    arrange: async () => {
      const readOnly = join(workDirPath(), `readonly-${Math.random().toString(36).slice(2)}`);
      await mkdir(readOnly);
      await chmod(readOnly, READ_ONLY);
      return {
        converters: [
          fakeConverter({
            id: 'sharp',
            edges: [edge('jpg', 'png')],
            convert: (req) => writeOutput(req),
          }),
        ],
        input: await source('jpg', 'sample.jpg', 'a.jpg'),
        resolveOutDir: () => readOnly,
        after: () => chmod(readOnly, ALL_ACCESS),
      };
    },
    expected: { state: 'failed', error: { code: 'OUTPUT_DIR_NOT_WRITABLE' } },
  },
  {
    fault: 'the disk is full (ENOSPC) while a step writes',
    arrange: async () => ({
      converters: [
        fakeConverter({
          id: 'sharp',
          edges: [edge('jpg', 'png')],
          convert: () => Promise.reject(Object.assign(new Error('no space'), { code: 'ENOSPC' })),
        }),
      ],
      input: await source('jpg', 'sample.jpg', 'a.jpg'),
    }),
    expected: { state: 'failed', error: { code: 'DISK_FULL' } },
  },
  {
    fault: 'a converter writes a symlink that points outside its out dir',
    arrange: async () => {
      const outside = await writeSource('secret.txt', 'outside the job');
      return {
        converters: [
          fakeConverter({
            id: 'sharp',
            edges: [edge('jpg', 'png')],
            convert: async (req) => {
              const link = join(req.outDir, `${req.baseName}.png`);
              await mkdir(req.outDir, { recursive: true });
              await symlink(outside, link);
              return [link];
            },
          }),
        ],
        input: await source('jpg', 'sample.jpg', 'a.jpg'),
      };
    },
    expected: { state: 'failed', error: { code: 'ENGINE_OUTPUT_MISSING' } },
  },
];

const dirContents = async (dir: string): Promise<string[]> => readdir(dir);

describe('failure matrix: one job, one fault', () => {
  it.each(rows.filter((row) => row.skip !== true))(
    '$fault',
    async (row) => {
      const arranged = await row.arrange();
      const { submitOne, outDir } = await harness({
        converters: arranged.converters,
        ...(arranged.resolveOutDir === undefined
          ? {}
          : {
              resolveOutDir: (_request, defaultDir) =>
                arranged.resolveOutDir?.(defaultDir) ?? defaultDir,
            }),
      });
      const before = await readFile(arranged.input).catch(() => undefined);
      const job = await submitOne(convertRequest(arranged.input, 'png'));

      expect(job.state).toBe(row.expected.state);
      if (row.expected.error !== undefined) expect(job.error).toMatchObject(row.expected.error);
      await expectNoTmp(job);
      expect(await dirContents(outDir)).toEqual([]);
      // Unreadable sources can't be read back until the mode is restored by `after`.
      await arranged.after?.();
      if (before !== undefined) expect(await readFile(arranged.input)).toEqual(before);
    },
    SLOW_PROCESS_TIMEOUT_MS,
  );
});

describe('failure matrix: cancel in each state', () => {
  it('while queued: cancelled at once, nothing runs, nothing is left', async () => {
    let started = 0;
    let firstRunning: () => void = () => undefined;
    const running = new Promise<void>((resolve) => {
      firstRunning = resolve;
    });
    const blocker = fakeConverter({
      id: 'sharp',
      edges: [edge('jpg', 'png')],
      convert: async (req, ctx) => {
        started += 1;
        firstRunning();
        await new Promise((resolve) => ctx.signal.addEventListener('abort', resolve));
        return writeOutput(req);
      },
    });
    const { runner, finished, outDir } = await harness({ converters: [blocker], slots: 1 });
    const first = await source('jpg', 'sample.jpg', 'first.jpg');
    const second = await source('jpg', 'sample.jpg', 'second.jpg');
    const before = await readFile(second);
    const { jobIds } = runner.submit([convertRequest(first, 'png'), convertRequest(second, 'png')]);
    await running;
    runner.cancel(jobIds[1] ?? '');
    const queued = await finished(jobIds[1] ?? '');
    runner.cancel(jobIds[0] ?? '');
    const firstJob = await finished(jobIds[0] ?? '');

    expect(queued.state).toBe('cancelled');
    expect(firstJob.state).toBe('cancelled');
    expect(started).toBe(1);
    await expectNoTmp(queued);
    await expectNoTmp(firstJob);
    expect(await dirContents(outDir)).toEqual([]);
    expect(await readFile(second)).toEqual(before);
  });

  it('in step 1 of 2: the second step never runs', async () => {
    let secondStepRan = false;
    const firstStep = fakeConverter({
      id: 'first',
      edges: [edge('jpg', 'png')],
      convert: async (_req, ctx) => {
        await new Promise((resolve) => ctx.signal.addEventListener('abort', resolve));
        return [];
      },
    });
    const secondStep = fakeConverter({
      id: 'second',
      edges: [edge('png', 'pdf')],
      convert: (req) => {
        secondStepRan = true;
        return writeOutput(req);
      },
    });
    const { runner, finished, outDir } = await harness({ converters: [firstStep, secondStep] });
    const input = await source('jpg', 'sample.jpg', 'a.jpg');
    const before = await readFile(input);
    const { jobIds } = runner.submit([convertRequest(input, 'pdf')]);
    await sleep(CHILD_START_TIMEOUT_MS / 50);
    runner.cancel(jobIds[0] ?? '');
    const job = await finished(jobIds[0] ?? '');

    expect(job.state).toBe('cancelled');
    expect(secondStepRan).toBe(false);
    await expectNoTmp(job);
    expect(await dirContents(outDir)).toEqual([]);
    expect(await readFile(input)).toEqual(before);
  });

  it('at the commit: cancelled, with no output, when it comes before the file is linked', async () => {
    const converter = fakeConverter({
      id: 'sharp',
      edges: [edge('jpg', 'png')],
      convert: (req) => writeOutput(req),
    });
    let jobId = '';
    let calls = 0;
    const { runner, finished, outDir } = await harness({
      converters: [converter],
      // The first call is the writable check at the start, the second is the commit.
      resolveOutDir: (_request, defaultDir) => {
        calls += 1;
        if (calls === 2) runner.cancel(jobId);
        return defaultDir;
      },
    });
    const input = await source('jpg', 'sample.jpg', 'a.jpg');
    const before = await readFile(input);
    jobId = runner.submit([convertRequest(input, 'png')]).jobIds[0] ?? '';
    const job = await finished(jobId);

    expect(job.state).toBe('cancelled');
    await expectNoTmp(job);
    expect(await dirContents(outDir)).toEqual([]);
    expect(await readFile(input)).toEqual(before);
  });
});

describe('failure matrix: happy path', () => {
  it('a batch of 5 with no faults ends with 5 done, and nothing left behind', async () => {
    const converter = fakeConverter({
      id: 'sharp',
      edges: [edge('jpg', 'png')],
      convert: (req) => writeOutput(req),
    });
    const { runner, finished, outDir } = await harness({ converters: [converter] });
    const inputs = await Promise.all(
      Array.from({ length: BATCH }, (_unused, index) =>
        source('jpg', 'sample.jpg', `file-${index}.jpg`),
      ),
    );
    const requests: JobRequest[] = inputs.map((input) => convertRequest(input, 'png'));
    const { jobIds } = runner.submit(requests);
    const jobs = await Promise.all(jobIds.map((jobId) => finished(jobId)));

    expect(jobs.map((job) => job.state)).toEqual(Array(BATCH).fill('done'));
    for (const job of jobs) await expectNoTmp(job);
    expect(await dirContents(outDir)).toHaveLength(BATCH);
  });
});
