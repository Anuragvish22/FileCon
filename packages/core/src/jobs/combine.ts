import { stat } from 'node:fs/promises';
import { CoreFailure } from '../errors.ts';
import type { CombineRequest, Combiner, JobCtx } from '../types/index.ts';
import { DEFAULT_TIMEOUT_MS } from './steps.ts';
import { scaledTimeout } from './timeout.ts';

const totalBytes = async (paths: string[]): Promise<number> => {
  const sizes = await Promise.all(
    paths.map(async (path) => (await stat(path).catch(() => undefined))?.size ?? 0),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
};

interface CombinePartsInput {
  combiner: Combiner;
  request: CombineRequest;
  jobSignal: AbortSignal;
  name: string; // fills the TIMEOUT text
  ctx: Omit<JobCtx, 'signal'>;
}

/** Runs a combiner with the same size-scaled timeout as a step. */
export const combineParts = async ({
  combiner,
  request,
  jobSignal,
  name,
  ctx,
}: CombinePartsInput): Promise<string> => {
  const controller = new AbortController();
  const relayAbort = (): void => controller.abort();
  jobSignal.addEventListener('abort', relayAbort, { once: true });
  if (jobSignal.aborted) relayAbort(); // cancelled while the sizes were read
  const limit = scaledTimeout(DEFAULT_TIMEOUT_MS, await totalBytes(request.inputs));
  let timer: NodeJS.Timeout | undefined;
  // The race ends the job even when a combiner ignores its signal, like a converter that does.
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CoreFailure('TIMEOUT', { engine: combiner.id, name }));
    }, limit);
  });
  try {
    return await Promise.race([
      combiner.combine(request, { ...ctx, signal: controller.signal }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    jobSignal.removeEventListener('abort', relayAbort);
  }
};
