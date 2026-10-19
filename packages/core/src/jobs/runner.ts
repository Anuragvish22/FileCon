import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, parse, relative } from 'node:path';
import { detect } from '../detect.ts';
import { CoreFailure, toCoreError } from '../errors.ts';
import { route as findRoute, type Graph } from '../graph/index.ts';
import type { Registry } from '../registry.ts';
import type {
  Combiner,
  Converter,
  CoreError,
  ErrorCode,
  Format,
  Job,
  JobCtx,
  JobRequest,
  Route,
  SubmitResult,
} from '../types/index.ts';
import { commitFile, commitFolder, safeStem } from './output.ts';
import type { Release, Scheduler } from './scheduler.ts';
import { makeJobDir, removeDir } from './tmp.ts';

// ARCHITECTURE section 9, FLOWS F4 to F9.
const DEFAULT_TIMEOUT_MS = 120_000;
const PROGRESS_INTERVAL_MS = 100; // updates are throttled to 10 per second
// Codes whose text names the engine ("{engine} failed to convert {name}"), so the engine id is filled in.
const ENGINE_CODES: readonly ErrorCode[] = ['ENGINE_FAILED', 'ENGINE_OUTPUT_MISSING', 'TIMEOUT'];
const TERMINAL_STATES: readonly Job['state'][] = ['done', 'failed', 'cancelled'];

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

type RunnableRequest = Extract<JobRequest, { kind: 'convert' | 'merge' }>;

interface Entry {
  job: Job;
  request: RunnableRequest;
  controller: AbortController;
  currentSource?: string; // the input being worked on, so a failure can say which one
  highestFraction: number;
  lastEmitAt: number;
  pendingTimer?: NodeJS.Timeout;
}

/** What a step reports: how many steps are done, and how far the current one is (null = unknown). */
type Report = (progress: { unit: number; fraction: number | null }) => void;

interface RunStepsInput {
  entry: Entry;
  source: string; // the job's own input, for error context
  input: string; // this chain's first file
  from: Format;
  steps: Route['steps'];
  baseDir: string;
  tmpDir: string;
  report: Report;
}

const isConverter = (item: Converter | Combiner | undefined): item is Converter =>
  item !== undefined && 'edges' in item;

const isInside = (dir: string, path: string): boolean => {
  const inside = relative(dir, path);
  return inside !== '' && !inside.startsWith('..') && !isAbsolute(inside);
};

/** Fills in what only the runner knows: which engine, which file. */
const withContext = (
  caught: unknown,
  context: { converter: Converter; source: string },
): CoreFailure => {
  const base = toCoreError(caught);
  const params = { ...base.params, name: basename(context.source) };
  if (ENGINE_CODES.includes(base.code))
    Object.assign(params, { engine: context.converter.engineId });
  return new CoreFailure(base.code, params, base.detail);
};

const verifyOutputs = async (produced: string[], outDir: string): Promise<void> => {
  const missing = (): CoreFailure => new CoreFailure('ENGINE_OUTPUT_MISSING');
  if (produced.length === 0) throw missing();
  for (const path of produced) {
    // shortcut: lexical check, symlinks aren't resolved; revisit if a converter ever creates links.
    if (!isInside(outDir, path)) throw missing();
    const stats = await stat(path).catch(() => undefined);
    if (stats === undefined || !stats.isFile() || stats.size === 0) throw missing();
  }
};

export const createRunner = (deps: RunnerDeps): Runner => {
  const { registry, scheduler } = deps;
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? randomUUID;
  const entries = new Map<string, Entry>();
  const listeners = new Set<(job: Job) => void>();

  const emit = (entry: Entry): void => {
    entry.lastEmitAt = now();
    const snapshot = structuredClone(entry.job);
    for (const listener of listeners) listener(snapshot);
  };

  const emitState = (entry: Entry): void => {
    clearTimeout(entry.pendingTimer);
    entry.pendingTimer = undefined;
    emit(entry);
  };

  const emitProgress = (entry: Entry): void => {
    const wait = PROGRESS_INTERVAL_MS - (now() - entry.lastEmitAt);
    if (wait <= 0) {
      emitState(entry);
    } else if (entry.pendingTimer === undefined) {
      // Trailing flush, so the last value of a burst is never lost.
      entry.pendingTimer = setTimeout(() => emitState(entry), wait);
    }
  };

  const setProgress = (
    entry: Entry,
    progress: { unit: number; total?: number; fraction: number | null },
  ): void => {
    const { job } = entry;
    // Engines and fan-out steps can report out of order: the overall fraction never goes back.
    let { fraction } = progress;
    if (fraction !== null) {
      fraction = Math.max(fraction, entry.highestFraction);
      entry.highestFraction = fraction;
    }
    const next = { unit: progress.unit, total: progress.total ?? job.progress.total, fraction };
    if (
      next.unit === job.progress.unit &&
      next.total === job.progress.total &&
      next.fraction === job.progress.fraction
    )
      return;
    job.progress = next;
    emitProgress(entry);
  };

  const addNote = (entry: Entry, id: string): void => {
    if (entry.job.notes.includes(id)) return;
    entry.job.notes.push(id);
    emitProgress(entry);
  };

  /** No route on the available graph: ENGINE_MISSING if the full graph has one, else NO_ROUTE. */
  const planRoute = (from: Format, to: Format): Route => {
    const { available, full } = deps.graphs();
    const found = findRoute(available, from, to);
    if (found !== null) return found;
    const wanted = findRoute(full, from, to);
    const missingStep = wanted?.steps.find((step) => !available.converterIds.has(step.converterId));
    const converter = missingStep === undefined ? undefined : registry.get(missingStep.converterId);
    if (isConverter(converter))
      throw new CoreFailure('ENGINE_MISSING', { engine: converter.engineId, pack: converter.pack });
    throw new CoreFailure('NO_ROUTE', { from, to });
  };

  /** The re-check at job start: the file must still exist and be a format we know. */
  const detectInput = async (input: string): Promise<Format> => {
    const result = await detect(input);
    if (result.error !== undefined)
      throw new CoreFailure(result.error.code, result.error.params, result.error.detail);
    if (result.format === null)
      throw new CoreFailure('UNSUPPORTED_FORMAT', { name: basename(input) });
    return result.format;
  };

  const runOneStep = async (input: {
    entry: Entry;
    converter: Converter;
    request: Parameters<Converter['convert']>[0];
    source: string;
    tmpDir: string;
    onFraction: (fraction: number | null) => void;
  }): Promise<string[]> => {
    const { entry, converter, request, source, tmpDir, onFraction } = input;
    const jobSignal = entry.controller.signal;
    const release = await scheduler.acquireConverter({
      converterId: converter.id,
      max: converter.maxConcurrent,
      signal: jobSignal,
    });
    const stepController = new AbortController();
    const relayAbort = (): void => stepController.abort();
    jobSignal.addEventListener('abort', relayAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stepController.abort();
    }, converter.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const ctx: JobCtx = {
      signal: stepController.signal,
      tmpDir,
      onProgress: onFraction,
      note: (id) => addNote(entry, id),
    };
    try {
      const produced = await converter.convert(request, ctx);
      // A converter that ignores the signal (sharp) only gets here once its operation ends.
      if (!timedOut && jobSignal.aborted) throw new CoreFailure('CANCELLED');
      if (!timedOut) await verifyOutputs(produced, request.outDir);
      if (timedOut) throw new CoreFailure('TIMEOUT');
      return produced;
    } catch (caught) {
      if (jobSignal.aborted && !timedOut) throw caught;
      throw withContext(timedOut ? new CoreFailure('TIMEOUT') : caught, { converter, source });
    } finally {
      clearTimeout(timer);
      jobSignal.removeEventListener('abort', relayAbort);
      release();
    }
  };

  /** Runs one file through a route. A fan-out step's many files feed the next step one by one. */
  const runSteps = async ({
    entry,
    source,
    input,
    from,
    steps,
    baseDir,
    tmpDir,
    report,
  }: RunStepsInput): Promise<string[]> => {
    let files = [input];
    let current = from;
    for (const [stepIndex, step] of steps.entries()) {
      const converter = registry.get(step.converterId);
      if (!isConverter(converter))
        throw new Error(`route names an unknown converter: ${step.converterId}`);
      const stepDir = join(baseDir, `step-${stepIndex}`);
      const produced: string[] = [];
      for (const [fileIndex, file] of files.entries()) {
        const outDir = files.length === 1 ? stepDir : join(stepDir, String(fileIndex));
        await mkdir(outDir, { recursive: true });
        produced.push(
          ...(await runOneStep({
            entry,
            converter,
            request: {
              input: file,
              from: current,
              to: step.to,
              outDir,
              baseName: safeStem(parse(file).name),
              options: entry.request.options,
            },
            source,
            tmpDir,
            onFraction: (fraction) =>
              report({
                unit: stepIndex,
                fraction:
                  fraction === null
                    ? null
                    : (stepIndex + (fileIndex + fraction) / files.length) / steps.length,
              }),
          })),
        );
        report({
          unit: stepIndex,
          fraction: (stepIndex + (fileIndex + 1) / files.length) / steps.length,
        });
      }
      files = produced;
      current = step.to;
    }
    return files;
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
    const found = planRoute(from, request.target);
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
    const dir = deps.resolveOutDir(request);
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
        steps: from === combiner.accepts ? [] : planRoute(from, combiner.accepts).steps,
      });
    }

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
    // shortcut: no timeout on a combiner, since they run in-process (pdf-lib, sharp); add one if an external engine ever combines.
    entry.currentSource = undefined; // the failure now concerns the whole merge, not one input
    const merged = await combiner.combine(parts, combineDir, request.options, {
      signal: entry.controller.signal,
      tmpDir,
      onProgress: (fraction) =>
        setProgress(entry, {
          unit: inputCount,
          fraction: fraction === null ? null : (inputCount + fraction) / (inputCount + 1),
        }),
      note: (id) => addNote(entry, id),
    });
    await verifyOutputs([merged], combineDir);
    const firstStem = parse(request.inputs[0] ?? 'file').name;
    return [
      await commitFile({
        src: merged,
        dir: deps.resolveOutDir(request),
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
          highestFraction: 0,
          lastEmitAt: 0,
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
      if (entry !== undefined && !TERMINAL_STATES.includes(entry.job.state))
        entry.controller.abort();
    },

    cancelAll() {
      for (const entry of entries.values())
        if (!TERMINAL_STATES.includes(entry.job.state)) entry.controller.abort();
    },

    on(_event, listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
