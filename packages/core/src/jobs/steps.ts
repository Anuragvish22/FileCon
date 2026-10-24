import { mkdir, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, parse, relative } from 'node:path';
import { CoreFailure, toCoreError } from '../errors.ts';
import { isConverter, type Registry } from '../registry.ts';
import type { Converter, ErrorCode, Format, JobCtx, JobRequest, Route } from '../types/index.ts';
import { safeStem } from './output.ts';
import type { ProgressState } from './progress.ts';
import type { Scheduler } from './scheduler.ts';
import { scaledTimeout } from './timeout.ts';

export const DEFAULT_TIMEOUT_MS = 120_000;
// Codes whose text names the engine ("{engine} failed to convert {name}"), so the engine id is filled in.
const ENGINE_CODES: readonly ErrorCode[] = ['ENGINE_FAILED', 'ENGINE_OUTPUT_MISSING', 'TIMEOUT'];

export type RunnableRequest = Extract<JobRequest, { kind: 'convert' | 'merge' }>;

/** A job as the runner tracks it. */
export interface Entry extends ProgressState {
  request: RunnableRequest;
  controller: AbortController;
  currentSource?: string; // the input being worked on, so a failure can say which one
}

/** What a step reports: how many steps are done, and how far the current one is (null = unknown). */
export type Report = (progress: { unit: number; fraction: number | null }) => void;

export interface RunStepsInput {
  entry: Entry;
  source: string; // the job's own input, for error context
  input: string; // this chain's first file
  from: Format;
  steps: Route['steps'];
  baseDir: string;
  tmpDir: string;
  report: Report;
}

export interface StepsDeps {
  registry: Registry;
  scheduler: Scheduler;
  addNote: (entry: Entry, id: string) => void;
}

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

export const verifyOutputs = async (produced: string[], outDir: string): Promise<void> => {
  const missing = (): CoreFailure => new CoreFailure('ENGINE_OUTPUT_MISSING');
  if (produced.length === 0) throw missing();
  for (const path of produced) {
    // shortcut: lexical check, symlinks aren't resolved; revisit if a converter ever creates links.
    if (!isInside(outDir, path)) throw missing();
    const stats = await stat(path).catch(() => undefined);
    if (stats === undefined || !stats.isFile() || stats.size === 0) throw missing();
  }
};

export const createSteps = ({ registry, scheduler, addNote }: StepsDeps) => {
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
    const sourceBytes = (await stat(source).catch(() => undefined))?.size ?? 0;
    const timer = setTimeout(
      () => {
        timedOut = true;
        stepController.abort();
      },
      scaledTimeout(converter.timeoutMs ?? DEFAULT_TIMEOUT_MS, sourceBytes),
    );
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

  return { runSteps };
};
