import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Converter } from '../../src/types/index.ts';
import { fakeCombiner, fakeConverter, writeOutput } from '../fakes.ts';
import {
  convertRequest,
  edge,
  expectNoTmp,
  harness,
  sleep,
  source,
  tmpDirsNow,
  useWorkDir,
  workDirPath,
  NO_OPTIONS,
} from '../harness.ts';

const SLOW_MS = 150; // longer than the 100 ms progress throttle
const TIMEOUT_MS = 50;
const BURST = 50;
const POLL_MS = 10;
const JOB_COUNT = 5;

const jpgToPng = (extra: Partial<Parameters<typeof fakeConverter>[0]> = {}): Converter =>
  fakeConverter({
    id: 'sharp',
    edges: [edge('jpg', 'png'), edge('png', 'jpg')],
    convert: (req) => writeOutput(req),
    ...extra,
  });

useWorkDir();

describe('runner: happy path', () => {
  it('converts one file: queued, running, done, outputs committed, temp dir gone', async () => {
    const { submitOne, updates, outDir } = await harness({ converters: [jpgToPng()] });
    const input = await source('jpg', 'sample.jpg', 'photo.jpg');
    const before = await readFile(input);
    const job = await submitOne(convertRequest(input, 'png'));

    expect(job.state).toBe('done');
    expect(job.outputs).toEqual([join(outDir, 'photo.png')]);
    expect(await readFile(join(outDir, 'photo.png'), 'utf8')).toBe('converted');
    expect(job.progress).toMatchObject({ unit: 1, total: 1, fraction: 1 });
    const states = updates.filter((update) => update.id === job.id).map((update) => update.state);
    expect(states[0]).toBe('queued');
    expect(states[1]).toBe('running');
    expect(states.at(-1)).toBe('done');
    expect(job.startedAt).toBeDefined();
    expect(job.endedAt).toBeDefined();
    await expectNoTmp(job);
    expect(await readFile(input)).toEqual(before);
  });

  it('starts jobs in submit order', async () => {
    const calls: string[] = [];
    const converter = jpgToPng({
      convert: (req) => (calls.push(req.baseName), writeOutput(req)),
    });
    const { runner, finished } = await harness({ converters: [converter], slots: 1 });
    const inputs = await Promise.all(
      ['one', 'two', 'three'].map((name) => source('jpg', 'sample.jpg', `${name}.jpg`)),
    );
    const { jobIds } = runner.submit(inputs.map((input) => convertRequest(input, 'png')));
    await Promise.all(jobIds.map(finished));
    expect(calls).toEqual(['one', 'two', 'three']);
  });

  it('a fan-out step feeds the next step one file at a time, in page order', async () => {
    const mapped: string[] = [];
    const pages = fakeConverter({
      id: 'pages',
      edges: [edge('pdf', 'png', { fanOut: true })],
      convert: async (req) => {
        const files: string[] = [];
        for (const page of [1, 2, 3]) {
          const [file] = await writeOutput({ ...req, baseName: `page-${page}` });
          files.push(file ?? '');
        }
        return files;
      },
    });
    const toWebp = fakeConverter({
      id: 'webp',
      edges: [edge('png', 'webp')],
      convert: (req) => (mapped.push(req.baseName), writeOutput(req)),
    });
    const { submitOne, outDir } = await harness({ converters: [pages, toWebp] });
    const job = await submitOne(
      convertRequest(await source('pdf', 'sample.pdf', 'book.pdf'), 'webp'),
    );

    expect(job.state).toBe('done');
    expect(mapped).toEqual(['page-1', 'page-2', 'page-3']);
    expect(job.outputs[0]).toBe(join(outDir, 'book (webp)'));
    expect((await readdir(join(outDir, 'book (webp)'))).sort()).toEqual([
      'page-001.webp',
      'page-002.webp',
      'page-003.webp',
    ]);
    await expectNoTmp(job);
  });

  it('merge: parts reach the combiner in input order, a pdf input is used as it is', async () => {
    let received: string[] = [];
    const combiner = fakeCombiner({
      id: 'merge-pdf',
      accepts: 'pdf',
      output: 'pdf',
      combine: async ({ inputs: parts, outDir }) => {
        received = parts;
        const path = join(outDir, 'merged.pdf');
        await writeFile(path, 'merged');
        return path;
      },
    });
    const toPdf = fakeConverter({
      id: 'pdflib',
      edges: [edge('png', 'pdf'), edge('jpg', 'pdf')],
      convert: (req) => writeOutput(req),
    });
    const { submitOne, outDir } = await harness({ converters: [toPdf], combiners: [combiner] });
    const png = await source('png', 'sample.png', 'first.png');
    const pdf = await source('pdf', 'sample.pdf', 'second.pdf');
    const jpg = await source('jpg', 'sample.jpg', 'third.jpg');
    const job = await submitOne({
      kind: 'merge',
      inputs: [png, pdf, jpg],
      combinerId: 'merge-pdf',
      options: NO_OPTIONS,
    });

    expect(job.state).toBe('done');
    expect(job.outputs).toEqual([join(outDir, 'first merged.pdf')]);
    expect(received.map((part) => part.split('/').at(-1))).toEqual([
      'first.pdf',
      'second.pdf',
      'third.pdf',
    ]);
    expect(received[1]).toBe(pdf);
    expect(job.progress).toMatchObject({ unit: 4, total: 4, fraction: 1 });
    await expectNoTmp(job);
  });
});

describe('runner: concurrency', () => {
  /** A converter that records how many of its steps run at once, and holds each for a moment. */
  const trackingConverter = (peak: { value: number; now: number }, extra = {}): Converter =>
    jpgToPng({
      convert: async (req) => {
        peak.now += 1;
        peak.value = Math.max(peak.value, peak.now);
        await sleep(TIMEOUT_MS);
        peak.now -= 1;
        return writeOutput(req);
      },
      ...extra,
    });

  it('never runs more jobs than the slot limit', async () => {
    const peak = { value: 0, now: 0 };
    const { runner, finished } = await harness({ converters: [trackingConverter(peak)], slots: 2 });
    const input = await source('jpg', 'sample.jpg');
    const { jobIds } = runner.submit(
      Array.from({ length: JOB_COUNT }, () => convertRequest(input, 'png')),
    );
    await Promise.all(jobIds.map(finished));
    expect(peak.value).toBe(2);
  });

  it('a converter with maxConcurrent 1 runs one step at a time, whatever the slots', async () => {
    const peak = { value: 0, now: 0 };
    const converter = trackingConverter(peak, { maxConcurrent: 1 });
    const { runner, finished } = await harness({ converters: [converter], slots: 4 });
    const input = await source('jpg', 'sample.jpg');
    const { jobIds } = runner.submit(
      Array.from({ length: JOB_COUNT }, () => convertRequest(input, 'png')),
    );
    await Promise.all(jobIds.map(finished));
    expect(peak.value).toBe(1);
  });

  it('setConcurrency lets waiting jobs start at once', async () => {
    const peak = { value: 0, now: 0 };
    const { runner, scheduler, finished } = await harness({
      converters: [trackingConverter(peak)],
      slots: 1,
    });
    const input = await source('jpg', 'sample.jpg');
    const { jobIds } = runner.submit(Array.from({ length: 3 }, () => convertRequest(input, 'png')));
    scheduler.setConcurrency(3);
    await Promise.all(jobIds.map(finished));
    expect(peak.value).toBe(3);
  });

  it('a failing job does not affect its siblings', async () => {
    const converter = jpgToPng({
      convert: (req) =>
        req.baseName === 'bad' ? Promise.reject(new Error('corrupt')) : writeOutput(req),
    });
    const { runner, finished } = await harness({ converters: [converter] });
    const bad = await source('jpg', 'sample.jpg', 'bad.jpg');
    const good = await source('jpg', 'sample.jpg', 'good.jpg');
    const { jobIds } = runner.submit([convertRequest(bad, 'png'), convertRequest(good, 'png')]);
    const [badJob, goodJob] = await Promise.all(jobIds.map(finished));
    expect(badJob?.state).toBe('failed');
    expect(badJob?.error).toMatchObject({ code: 'ENGINE_FAILED', input: bad });
    expect(goodJob?.state).toBe('done');
  });
});

describe('runner: failures', () => {
  it.each([
    ['nothing returned', () => Promise.resolve([] as string[])],
    [
      'an empty file',
      async (req: Parameters<Converter['convert']>[0]) => {
        const [path] = await writeOutput(req, '');
        return [path ?? ''];
      },
    ],
    [
      'a file outside outDir',
      async (req: Parameters<Converter['convert']>[0]) => {
        const outside = join(workDirPath(), `outside-${req.baseName}.png`);
        await writeFile(outside, 'data');
        return [outside];
      },
    ],
  ])('%s is ENGINE_OUTPUT_MISSING, with no output and no temp dir', async (_name, convert) => {
    const { submitOne, outDir } = await harness({ converters: [jpgToPng({ convert })] });
    const input = await source('jpg', 'sample.jpg', 'photo.jpg');
    const before = await readFile(input);
    const job = await submitOne(convertRequest(input, 'png'));

    expect(job.state).toBe('failed');
    expect(job.error).toMatchObject({
      code: 'ENGINE_OUTPUT_MISSING',
      params: { engine: 'sharp', name: 'photo.jpg' },
      input,
    });
    expect(await readdir(outDir)).toEqual([]);
    await expectNoTmp(job);
    expect(await readFile(input)).toEqual(before);
  });

  it('a step over its timeout is TIMEOUT', async () => {
    const converter = jpgToPng({
      timeoutMs: TIMEOUT_MS,
      convert: (_req, ctx) =>
        new Promise((_resolve, reject) =>
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    });
    const { submitOne } = await harness({ converters: [converter] });
    const job = await submitOne(
      convertRequest(await source('jpg', 'sample.jpg', 'slow.jpg'), 'png'),
    );
    expect(job.state).toBe('failed');
    expect(job.error).toMatchObject({
      code: 'TIMEOUT',
      params: { engine: 'sharp', name: 'slow.jpg' },
    });
    await expectNoTmp(job);
  });

  it('a missing input is INPUT_NOT_FOUND', async () => {
    const { submitOne } = await harness({ converters: [jpgToPng()] });
    const job = await submitOne(convertRequest(join(workDirPath(), 'gone.jpg'), 'png'));
    expect(job.error).toMatchObject({
      code: 'INPUT_NOT_FOUND',
      input: join(workDirPath(), 'gone.jpg'),
    });
    await expectNoTmp(job);
  });

  it('ENGINE_MISSING when only the full graph has a route, NO_ROUTE when none does', async () => {
    const { submitOne } = await harness({
      converters: [jpgToPng({ pack: 'office' })],
      availableIds: [],
    });
    const input = await source('jpg', 'sample.jpg');
    const missing = await submitOne(convertRequest(input, 'png'));
    expect(missing.error).toMatchObject({
      code: 'ENGINE_MISSING',
      params: { engine: 'sharp', pack: 'office' },
    });
    const none = await submitOne(convertRequest(input, 'webp'));
    expect(none.error).toMatchObject({ code: 'NO_ROUTE', params: { from: 'jpg', to: 'webp' } });
  });

  it('merge: one failing input fails the job, names that input, and writes nothing', async () => {
    const combiner = fakeCombiner({ id: 'merge-pdf', accepts: 'pdf', output: 'pdf' });
    const toPdf = fakeConverter({
      id: 'pdflib',
      edges: [edge('png', 'pdf'), edge('jpg', 'pdf')],
      convert: (req) =>
        req.baseName === 'bad' ? Promise.reject(new Error('corrupt')) : writeOutput(req),
    });
    const { submitOne, outDir } = await harness({ converters: [toPdf], combiners: [combiner] });
    const good = await source('png', 'sample.png', 'good.png');
    const bad = await source('jpg', 'sample.jpg', 'bad.jpg');
    const job = await submitOne({
      kind: 'merge',
      inputs: [good, bad],
      combinerId: 'merge-pdf',
      options: NO_OPTIONS,
    });
    expect(job.state).toBe('failed');
    expect(job.error).toMatchObject({ code: 'ENGINE_FAILED', input: bad });
    expect(await readdir(outDir)).toEqual([]);
    await expectNoTmp(job);
  });

  it('merge: a missing route for any input fails before any step runs', async () => {
    let stepsRun = 0;
    const toPdf = fakeConverter({
      id: 'pdflib',
      edges: [edge('png', 'pdf')],
      convert: (req) => (stepsRun++, writeOutput(req)),
    });
    const combiner = fakeCombiner({ id: 'merge-pdf', accepts: 'pdf', output: 'pdf' });
    const { submitOne } = await harness({ converters: [toPdf], combiners: [combiner] });
    const png = await source('png', 'sample.png');
    const jpg = await source('jpg', 'sample.jpg');
    const job = await submitOne({
      kind: 'merge',
      inputs: [png, jpg],
      combinerId: 'merge-pdf',
      options: NO_OPTIONS,
    });
    expect(job.error).toMatchObject({ code: 'NO_ROUTE', input: jpg });
    expect(stepsRun).toBe(0);
  });

  it('an unknown combiner rejects the whole call and creates no job', async () => {
    const { runner, updates } = await harness({ converters: [jpgToPng()] });
    const input = await source('jpg', 'sample.jpg');
    expect(() =>
      runner.submit([
        convertRequest(input, 'png'),
        { kind: 'merge', inputs: [input], combinerId: 'nope', options: NO_OPTIONS },
      ]),
    ).toThrow();
    expect(updates).toEqual([]);
  });
});

describe('runner: cancel', () => {
  /** A converter that waits for its abort signal, as an engine killed by spawn does. */
  const waitsForAbort = (started: { count: number }): Converter =>
    jpgToPng({
      convert: (_req, ctx) =>
        new Promise((_resolve, reject) => {
          started.count += 1;
          ctx.signal.addEventListener('abort', () => reject(new Error('killed')));
        }),
    });

  it('cancel while running: cancelled only after the temp dir is gone, no output', async () => {
    const started = { count: 0 };
    const { runner, updates, finished, outDir } = await harness({
      converters: [waitsForAbort(started)],
    });
    const input = await source('jpg', 'sample.jpg');
    const before = await readFile(input);
    const tmpWhenCancelled: string[][] = [];
    runner.on('update', (job) => {
      if (job.state === 'cancelled') tmpWhenCancelled.push(tmpDirsNow(job));
    });
    const { jobIds } = runner.submit([convertRequest(input, 'png')]);
    while (started.count === 0) await sleep(POLL_MS);
    runner.cancel(jobIds[0] ?? '');
    const job = await finished(jobIds[0] ?? '');

    expect(job.state).toBe('cancelled');
    expect(tmpWhenCancelled).toEqual([[]]);
    expect(await readdir(outDir)).toEqual([]);
    expect(await readFile(input)).toEqual(before);
    expect(updates.filter((update) => update.state === 'cancelled')).toHaveLength(1);
  });

  it('cancel while queued: cancelled at once, its converter never runs', async () => {
    const started = { count: 0 };
    const { runner, finished } = await harness({ converters: [waitsForAbort(started)], slots: 1 });
    const input = await source('jpg', 'sample.jpg');
    const { jobIds } = runner.submit([convertRequest(input, 'png'), convertRequest(input, 'png')]);
    runner.cancel(jobIds[1] ?? '');
    const queued = await finished(jobIds[1] ?? '');
    expect(queued.state).toBe('cancelled');
    expect(queued.startedAt).toBeUndefined();
    expect(started.count).toBeLessThanOrEqual(1);
    runner.cancelAll();
    expect((await finished(jobIds[0] ?? '')).state).toBe('cancelled');
  });

  it('cancel after done does nothing', async () => {
    const { runner, submitOne, updates } = await harness({ converters: [jpgToPng()] });
    const job = await submitOne(convertRequest(await source('jpg', 'sample.jpg'), 'png'));
    const count = updates.length;
    runner.cancel(job.id);
    runner.cancel('no-such-job');
    await sleep(POLL_MS);
    expect(updates).toHaveLength(count);
    expect(updates.at(-1)?.state).toBe('done');
  });
});

describe('runner: progress and notes', () => {
  it('the overall fraction never decreases, even when a step reports a lower value', async () => {
    const converter = jpgToPng({
      convert: async (req, ctx) => {
        for (const fraction of [0.8, 0.3, 0.9]) {
          ctx.onProgress(fraction);
          await sleep(SLOW_MS); // apart by more than the throttle, so each one is sent
        }
        return writeOutput(req);
      },
    });
    const { submitOne, updates } = await harness({ converters: [converter] });
    const job = await submitOne(convertRequest(await source('jpg', 'sample.jpg'), 'png'));
    const fractions = updates
      .filter((update) => update.id === job.id)
      .map((update) => update.progress.fraction);
    const numbers = fractions.filter((fraction): fraction is number => fraction !== null);
    expect(numbers.length).toBeGreaterThan(2);
    expect(numbers).toEqual([...numbers].sort((first, second) => first - second));
  });

  it('a step that reports null makes the overall fraction null, and the unit still advances', async () => {
    const converter = jpgToPng({
      convert: async (req, ctx) => {
        ctx.onProgress(null);
        await sleep(SLOW_MS);
        return writeOutput(req);
      },
    });
    const { submitOne, updates } = await harness({ converters: [converter] });
    const job = await submitOne(convertRequest(await source('jpg', 'sample.jpg'), 'png'));
    expect(updates.some((update) => update.progress.fraction === null)).toBe(true);
    expect(job.progress.fraction).toBe(1);
  });

  it('progress updates are throttled, state changes are not', async () => {
    let clock = 1_000_000;
    const converter = jpgToPng({
      convert: (req, ctx) => {
        for (let step = 1; step <= BURST; step += 1) ctx.onProgress(step / BURST / 2);
        return writeOutput(req);
      },
    });
    const { submitOne, updates } = await harness({ converters: [converter], now: () => clock });
    const job = await submitOne(convertRequest(await source('jpg', 'sample.jpg'), 'png'));
    clock += 1;
    const progressOnly = updates.filter(
      (update) => update.state === 'running' && update.progress.fraction !== 0,
    );
    // 50 reports inside one throttle window: at most one is flushed.
    expect(progressOnly.length).toBeLessThanOrEqual(1);
    expect(updates.map((update) => update.state)).toContain('queued');
    expect(job.state).toBe('done');
  });

  it('ctx.note ends up in Job.notes, deduped and in order', async () => {
    const converter = jpgToPng({
      convert: (req, ctx) => {
        for (const id of ['downscaled', 'reencoded', 'downscaled']) ctx.note(id);
        return writeOutput(req);
      },
    });
    const { submitOne } = await harness({ converters: [converter] });
    const job = await submitOne(convertRequest(await source('jpg', 'sample.jpg'), 'png'));
    expect(job.notes).toEqual(['downscaled', 'reencoded']);
  });
});
