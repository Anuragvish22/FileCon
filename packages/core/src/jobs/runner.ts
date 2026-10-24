import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { basename, join, parse } from 'node:path';
import { CoreFailure, toCoreError } from '../errors.ts';
import type { Graph } from '../graph/index.ts';
import { isConverter, type Registry } from '../registry.ts';
import {
  isTerminal,
  type Combiner,
  type CoreError,
  type Format,
  type Job,
  type JobRequest,
  type Route,
  type SubmitResult,
} from '../types/index.ts';
import { combineParts } from './combine.ts';
import { commitFile, commitFolder } from './output.ts';
import { detectInput, planRoute } from './plan.ts';
import { createProgress, newProgressState } from './progress.ts';
import type { Release, Scheduler } from './scheduler.ts';
import { createSteps, verifyOutputs, type Entry, type RunnableRequest } from './steps.ts';
import { makeJobDir, removeDir } from './tmp.ts';

// ARCHITECTURE section 9, FLOWS F4 to F9.

export interface RunnerDeps {
  registry: Registry;
  /** A function, so the host can rebuild the graphs when engines change. */
  graphs(): { available: Graph; full: Graph };
  scheduler: Scheduler;
  /** Where outputs go: Settings.output resolved for this request. */
  resolveOutDir(request: JobRequest): string;
  now?: () => number;
  newId?: () => string;
}

export interface Runner {
  submit(requests: JobRequest[]): SubmitResult;
  cancel(jobId: string): void;
  cancelAll(): void;
  on(event: 'update', listener: (job: Job) => void): () => void;
}

type Outcome =
  | { state: 'done'; outputs: string[] }
  | { state: 'failed'; error: CoreError }
  | { state: 'cancelled' };

export const createRunner = (deps: RunnerDeps): Runner => {
  const { registry, scheduler } = deps;
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? randomUUID;
  const entries = new Map<string, Entry>();
  const listeners = new Set<(job: Job) => void>();

  const publish = (snapshot: Job): void => {
    for (const listener of listeners) listener(snapshot);
  };
  const { emitState, setProgress, addNote } = createProgress({ now, publish });
  const { runSteps } = createSteps({ registry, scheduler, addNote });
  const plan = (from: Format, to: Format): Route => planRoute(deps, from, to);

  /** The last point where a cancel still leaves no output: once the file is linked, the job is done. */
  const outDirBeforeCommit = (entry: Entry, request: RunnableRequest): string => {
    const dir = deps.resolveOutDir(request);
    if (entry.controller.signal.aborted) throw new CoreFailure('CANCELLED');
    return dir;
  };

  /** Checked before any step runs, so a read-only folder fails in a moment and not after minutes of work. */
  const requireWritableOutDir = async (request: RunnableRequest): Promise<void> => {
    const dir = deps.resolveOutDir(request);
    await access(dir, constants.W_OK).catch(() => {
      throw new CoreFailure('OUTPUT_DIR_NOT_WRITABLE', { dir });
    });
  };

  const combinerOf = (combinerId: string): Combiner => {
    const item = registry.get(combinerId);
    if (item === undefined || isConverter(item)) throw new CoreFailure('INVALID_REQUEST');
    return item;
  };

  const runConvert = async (
    entry: Entry,
    request: Extract<JobRequest, { kind: 'convert' }>,
    tmpDir: string,
  ): Promise<string[]> => {
    entry.currentSource = request.input;
    const from = await detectInput(request.input);
    const found = plan(from, request.target);
    await requireWritableOutDir(request);
    setProgress(entry, { unit: 0, total: found.steps.length, fraction: 0 });
    const files = await runSteps({
      entry,
      source: request.input,
      input: request.input,
      from,
      steps: found.steps,
      baseDir: tmpDir,
      tmpDir,
      report: ({ unit, fraction }) => setProgress(entry, { unit, fraction }),
    });
    const dir = outDirBeforeCommit(entry, request);
    const stem = parse(request.input).name;
    if (files.length === 1 && files[0] !== undefined)
      return [await commitFile({ src: files[0], dir, stem, ext: request.target })];
    return commitFolder({ files, dir, stem, ext: request.target });
  };

  const runMerge = async (
    entry: Entry,
    request: Extract<JobRequest, { kind: 'merge' }>,
    tmpDir: string,
  ): Promise<string[]> => {
    const combiner = combinerOf(request.combinerId);
    const inputCount = request.inputs.length;
    // Every input is checked and routed before any step runs, so a bad one fails the job early.
    const plans: { input: string; from: Format; steps: Route['steps'] }[] = [];
    for (const input of request.inputs) {
      entry.currentSource = input;
      const from = await detectInput(input);
      plans.push({
        input,
        from,
        steps: from === combiner.accepts ? [] : plan(from, combiner.accepts).steps,
      });
    }

    await requireWritableOutDir(request);
    const parts: string[] = [];
    for (const [index, plan] of plans.entries()) {
      entry.currentSource = plan.input;
      const done = (fraction: number): number => (index + fraction) / (inputCount + 1);
      setProgress(entry, { unit: index, fraction: done(0) });
      parts.push(
        ...(await runSteps({
          entry,
          source: plan.input,
          input: plan.input,
          from: plan.from,
          steps: plan.steps,
          baseDir: join(tmpDir, `part-${index}`),
          tmpDir,
          report: ({ fraction }) =>
            setProgress(entry, {
              unit: index,
              fraction: fraction === null ? null : done(fraction),
            }),
        })),
      );
    }

    const combineDir = join(tmpDir, 'combine');
    await mkdir(combineDir, { recursive: true });
    entry.currentSource = undefined; // the failure now concerns the whole merge, not one input
    const merged = await combineParts({
      combiner,
      request: { inputs: parts, outDir: combineDir, options: request.options },
      jobSignal: entry.controller.signal,
      name: basename(request.inputs[0] ?? ''),
      ctx: {
        tmpDir,
        onProgress: (fraction) =>
          setProgress(entry, {
            unit: inputCount,
            fraction: fraction === null ? null : (inputCount + fraction) / (inputCount + 1),
          }),
        note: (id) => addNote(entry, id),
      },
    });
    await verifyOutputs([merged], combineDir);
    const firstStem = parse(request.inputs[0] ?? 'file').name;
    return [
      await commitFile({
        src: merged,
        dir: outDirBeforeCommit(entry, request),
        stem: `${firstStem} merged`,
        ext: combiner.output,
      }),
    ];
  };

  const finish = (entry: Entry, outcome: Outcome): void => {
    const { job } = entry;
    job.state = outcome.state;
    job.endedAt = now();
    if (outcome.state === 'done') {
      job.outputs = outcome.outputs;
      job.progress = { ...job.progress, unit: job.progress.total, fraction: 1 };
    }
    if (outcome.state === 'failed') job.error = outcome.error;
    emitState(entry);
  };

  const execute = async (entry: Entry): Promise<void> => {
    const { job, request, controller } = entry;
    let releaseSlot: Release;
    try {
      releaseSlot = await scheduler.acquireSlot(controller.signal);
    } catch {
      finish(entry, { state: 'cancelled' }); // cancelled while still queued
      return;
    }
    let tmpDir: string | undefined;
    let outcome: Outcome;
    try {
      job.state = 'running';
      job.startedAt = now();
      emitState(entry);
      tmpDir = await makeJobDir(job.id);
      const outputs =
        request.kind === 'merge'
          ? await runMerge(entry, request, tmpDir)
          : await runConvert(entry, request, tmpDir);
      outcome = { state: 'done', outputs };
    } catch (caught) {
      const error = toCoreError(caught);
      if (entry.currentSource !== undefined) error.input ??= entry.currentSource;
      outcome = controller.signal.aborted ? { state: 'cancelled' } : { state: 'failed', error };
    } finally {
      releaseSlot();
      if (tmpDir !== undefined) await removeDir(tmpDir);
    }
    // Only now, so "cancelled" and "done" mean the temp dir is already gone.
    finish(entry, outcome);
  };

  return {
    submit(requests) {
      // Checked for the whole call first, so one bad request creates no job at all.
      const runnable = requests.map((request): RunnableRequest => {
        if (request.kind === 'extract') throw new Error('extract jobs arrive with M1.1-3');
        if (request.kind === 'merge') combinerOf(request.combinerId);
        return request;
      });
      const batchId = newId();
      const created = runnable.map((request): Entry => {
        const merge = request.kind === 'merge';
        const job: Job = {
          id: newId(),
          batchId,
          kind: request.kind,
          inputs: merge ? request.inputs : [request.input],
          target: merge ? combinerOf(request.combinerId).output : request.target,
          state: 'queued',
          progress: { unit: 0, total: merge ? request.inputs.length + 1 : 1, fraction: 0 },
          outputs: [],
          notes: [],
          createdAt: now(),
        };
        const entry: Entry = {
          job,
          request,
          controller: new AbortController(),
          ...newProgressState(),
        };
        entries.set(job.id, entry);
        return entry;
      });
      for (const entry of created) emitState(entry);
      // Started in submit order, and each asks for its slot before its first await: that is the FIFO.
      for (const entry of created) void execute(entry);
      return { batchId, jobIds: created.map((entry) => entry.job.id) };
    },

    cancel(jobId) {
      const entry = entries.get(jobId);
      if (entry !== undefined && !isTerminal(entry.job.state)) entry.controller.abort();
    },

    cancelAll() {
      for (const entry of entries.values())
        if (!isTerminal(entry.job.state)) entry.controller.abort();
    },

    on(_event, listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
