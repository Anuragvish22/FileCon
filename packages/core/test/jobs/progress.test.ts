import { describe, expect, it, vi } from 'vitest';
import { createProgress, newProgressState, type ProgressState } from '../../src/jobs/progress.ts';
import type { Job } from '../../src/types/index.ts';

const THROTTLE_MS = 100;
const BURST = 20;

const setup = () => {
  let clock = 1_000;
  const published: Job[] = [];
  const progress = createProgress({ now: () => clock, publish: (job) => published.push(job) });
  const job: Job = {
    id: 'job',
    batchId: 'batch',
    kind: 'convert',
    inputs: ['a.jpg'],
    target: 'png',
    state: 'running',
    progress: { unit: 0, total: 3, fraction: 0 },
    outputs: [],
    notes: [],
    createdAt: clock,
  };
  const entry: ProgressState = { job, ...newProgressState() };
  return {
    progress,
    entry,
    published,
    advance: (ms: number) => {
      clock += ms;
    },
  };
};

describe('progress', () => {
  it('sends the first update at once', () => {
    const { progress, entry, published } = setup();
    progress.setProgress(entry, { unit: 1, fraction: 0.3 });
    expect(published.map((job) => job.progress.fraction)).toEqual([0.3]);
  });

  it('throttles a burst, then flushes the last value after the interval', () => {
    vi.useFakeTimers();
    const { progress, entry, published, advance } = setup();
    progress.setProgress(entry, { unit: 0, fraction: 0.01 });
    for (let step = 2; step <= BURST; step += 1) {
      advance(1);
      progress.setProgress(entry, { unit: 0, fraction: step / 100 });
    }
    expect(published).toHaveLength(1);
    vi.advanceTimersByTime(THROTTLE_MS);
    expect(published.at(-1)?.progress.fraction).toBe(BURST / 100);
    expect(published).toHaveLength(2);
    vi.useRealTimers();
  });

  it('never sends the fraction backwards', () => {
    const { progress, entry, published, advance } = setup();
    progress.setProgress(entry, { unit: 0, fraction: 0.6 });
    advance(THROTTLE_MS);
    progress.setProgress(entry, { unit: 1, fraction: 0.2 });
    expect(published.at(-1)?.progress.fraction).toBe(0.6);
  });

  it('keeps an unknown fraction (null) as it is', () => {
    const { progress, entry, published } = setup();
    progress.setProgress(entry, { unit: 0, fraction: null });
    expect(published.at(-1)?.progress.fraction).toBeNull();
  });

  it('sends nothing when nothing changed', () => {
    const { progress, entry, published } = setup();
    progress.setProgress(entry, { unit: 0, fraction: 0 });
    expect(published).toHaveLength(0);
  });

  it('a state change goes out at once and cancels the pending flush', () => {
    vi.useFakeTimers();
    const { progress, entry, published, advance } = setup();
    progress.setProgress(entry, { unit: 0, fraction: 0.1 });
    advance(1);
    progress.setProgress(entry, { unit: 0, fraction: 0.2 });
    entry.job.state = 'done';
    progress.emitState(entry);
    vi.advanceTimersByTime(THROTTLE_MS);
    expect(published.map((job) => job.state)).toEqual(['running', 'done']);
    vi.useRealTimers();
  });

  it('records a note once and sends a snapshot, not the live job', () => {
    const { progress, entry, published } = setup();
    progress.addNote(entry, 'downscaled');
    progress.addNote(entry, 'downscaled');
    expect(entry.job.notes).toEqual(['downscaled']);
    expect(published[0]).not.toBe(entry.job);
  });
});
