import { readdirSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect } from 'vitest';
import { buildGraph } from '../src/graph/index.ts';
import { createRunner } from '../src/jobs/runner.ts';
import { createScheduler } from '../src/jobs/scheduler.ts';
import {
  isTerminal,
  type Combiner,
  type Converter,
  type ConvertOptions,
  type Job,
  type JobRequest,
} from '../src/types/index.ts';
import { registryOf } from './fakes.ts';

export const NO_OPTIONS: ConvertOptions = {};

export const fixture = (folder: string, name: string): string =>
  fileURLToPath(new URL(`../../../test/fixtures/${folder}/${name}`, import.meta.url));

export const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

let workDir: string;
let counter = 0;

/** A private work dir for one test file, created before its tests and removed after. */
export const useWorkDir = (): void => {
  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'filecon-test-'));
  });
  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });
};

export const workDirPath = (): string => workDir;

/** A file with given bytes in its own private dir, for inputs a test builds itself. */
export const writeSource = async (name: string, content: string | Uint8Array): Promise<string> => {
  counter += 1;
  const dir = join(workDir, `src-${counter}`);
  await mkdir(dir);
  const path = join(dir, name);
  await writeFile(path, content);
  return path;
};

/** A private copy of a fixture, so "the source is untouched" can be checked per test. */
export const source = async (folder: string, name: string, as = name): Promise<string> => {
  counter += 1;
  const dir = join(workDir, `src-${counter}`);
  await mkdir(dir);
  const path = join(dir, as);
  await copyFile(fixture(folder, name), path);
  return path;
};

export const convertRequest = (input: string, target: string): JobRequest => ({
  kind: 'convert',
  input,
  target,
  options: NO_OPTIONS,
});

export const edge = (from: string, to: string, extra: { fanOut?: boolean } = {}) => ({
  from,
  to,
  cost: 1,
  ...extra,
});

export interface HarnessOptions {
  converters: Converter[];
  combiners?: Combiner[];
  slots?: number;
  availableIds?: string[];
  now?: () => number;
  resolveOutDir?: (request: JobRequest, outDir: string) => string;
}

export const harness = async (options: HarnessOptions) => {
  const registry = registryOf(...options.converters, ...(options.combiners ?? []));
  const everyId = registry.converters().map((converter) => converter.id);
  const graphOf = (ids: string[]) =>
    buildGraph({ registry, availableIds: new Set(ids), priority: [] });
  const scheduler = createScheduler(options.slots ?? 4);
  counter += 1;
  const outDir = join(workDir, `out-${counter}`);
  await mkdir(outDir);
  const runner = createRunner({
    registry,
    graphs: () => ({ available: graphOf(options.availableIds ?? everyId), full: graphOf(everyId) }),
    scheduler,
    resolveOutDir: (request) => options.resolveOutDir?.(request, outDir) ?? outDir,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  const updates: Job[] = [];
  const waiting = new Map<string, ((job: Job) => void)[]>();
  const finalJobs = new Map<string, Job>();
  runner.on('update', (job) => {
    updates.push(job);
    if (!isTerminal(job.state)) return;
    finalJobs.set(job.id, job);
    for (const resolve of waiting.get(job.id) ?? []) resolve(job);
  });
  const finished = (jobId: string): Promise<Job> => {
    const known = finalJobs.get(jobId);
    if (known !== undefined) return Promise.resolve(known);
    return new Promise((resolve) => waiting.set(jobId, [...(waiting.get(jobId) ?? []), resolve]));
  };
  const submitOne = async (request: JobRequest): Promise<Job> => {
    const { jobIds } = runner.submit([request]);
    return finished(jobIds[0] ?? '');
  };
  return { runner, scheduler, outDir, updates, finished, submitOne };
};

/** The job's temp dir is `filecon-<jobId>-XXXX` under the OS temp dir. */
export const tmpDirsOf = async (job: Job): Promise<string[]> =>
  (await readdir(tmpdir())).filter((name) => name.startsWith(`filecon-${job.id}-`));

/** Synchronous, so a listener can check the temp dir at the moment an update is sent. */
export const tmpDirsNow = (job: Job): string[] =>
  readdirSync(tmpdir()).filter((name) => name.startsWith(`filecon-${job.id}-`));

export const expectNoTmp = async (job: Job): Promise<void> => {
  expect(await tmpDirsOf(job)).toEqual([]);
};
