import type { Job } from '../types/index.ts';

const PROGRESS_INTERVAL_MS = 100; // updates are throttled to 10 per second

/** What the throttle remembers per job. The runner's entry for a job extends it. */
export interface ProgressState {
  job: Job;
  highestFraction: number;
  lastEmitAt: number;
  pendingTimer?: NodeJS.Timeout;
}

export const newProgressState = (): Omit<ProgressState, 'job'> => ({
  highestFraction: 0,
  lastEmitAt: 0,
});

interface ProgressDeps {
  now: () => number;
  /** Gets a snapshot of the job, never the live object. */
  publish: (snapshot: Job) => void;
}

export const createProgress = ({ now, publish }: ProgressDeps) => {
  /** A state change goes out at once and cancels the trailing flush. */
  const emitState = (entry: ProgressState): void => {
    clearTimeout(entry.pendingTimer);
    entry.pendingTimer = undefined;
    entry.lastEmitAt = now();
    publish(structuredClone(entry.job));
  };

  const emitProgress = (entry: ProgressState): void => {
    const wait = PROGRESS_INTERVAL_MS - (now() - entry.lastEmitAt);
    if (wait <= 0) {
      emitState(entry);
    } else if (entry.pendingTimer === undefined) {
      // Trailing flush, so the last value of a burst is never lost.
      entry.pendingTimer = setTimeout(() => emitState(entry), wait);
    }
  };

  const setProgress = (
    entry: ProgressState,
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

  const addNote = (entry: ProgressState, id: string): void => {
    if (entry.job.notes.includes(id)) return;
    entry.job.notes.push(id);
    emitProgress(entry);
  };

  return { emitState, setProgress, addNote };
};
