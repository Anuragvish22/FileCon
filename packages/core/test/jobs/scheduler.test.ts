import { describe, expect, it } from 'vitest';
import { createScheduler } from '../../src/jobs/scheduler.ts';

const never = new AbortController().signal;

/** Lets every already-resolved promise run its callbacks. */
const settle = (): Promise<void> => new Promise((done) => setImmediate(done));

describe('scheduler: happy path', () => {
  it('grants slots in FIFO order as they free up', async () => {
    const scheduler = createScheduler(1);
    const order: string[] = [];
    const first = await scheduler.acquireSlot(never);
    const second = scheduler.acquireSlot(never).then((release) => (order.push('second'), release));
    const third = scheduler.acquireSlot(never).then((release) => (order.push('third'), release));
    first();
    (await second)();
    await third;
    expect(order).toEqual(['second', 'third']);
  });

  it('never holds more slots than the limit', async () => {
    const scheduler = createScheduler(2);
    let running = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        const release = await scheduler.acquireSlot(never);
        running += 1;
        peak = Math.max(peak, running);
        await settle();
        running -= 1;
        release();
      }),
    );
    expect(peak).toBe(2);
  });
});

describe('scheduler: must also pass', () => {
  it('a converter with max 1 serializes its steps, others are unaffected', async () => {
    const scheduler = createScheduler(4);
    const first = await scheduler.acquireConverter({ converterId: 'lo', max: 1, signal: never });
    let secondGranted = false;
    const second = scheduler
      .acquireConverter({ converterId: 'lo', max: 1, signal: never })
      .then(() => (secondGranted = true));
    await scheduler.acquireConverter({ converterId: 'sharp', max: undefined, signal: never });
    await settle();
    expect(secondGranted).toBe(false);
    first();
    await second;
    expect(secondGranted).toBe(true);
  });

  it('aborting while waiting rejects with CANCELLED and leaves the queue', async () => {
    const scheduler = createScheduler(1);
    const held = await scheduler.acquireSlot(never);
    const controller = new AbortController();
    const waiting = scheduler.acquireSlot(controller.signal);
    const behind = scheduler.acquireSlot(never);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ error: { code: 'CANCELLED' } });
    held();
    // The aborted waiter must not swallow the slot: the one behind it gets it.
    (await behind)();
  });

  it('an already aborted signal rejects at once and takes no slot', async () => {
    const scheduler = createScheduler(1);
    await expect(scheduler.acquireSlot(AbortSignal.abort())).rejects.toMatchObject({
      error: { code: 'CANCELLED' },
    });
    (await scheduler.acquireSlot(never))();
  });

  it('releasing twice frees only one slot', async () => {
    const scheduler = createScheduler(1);
    const release = await scheduler.acquireSlot(never);
    release();
    release();
    const second = await scheduler.acquireSlot(never);
    let thirdGranted = false;
    void scheduler.acquireSlot(never).then(() => (thirdGranted = true));
    await settle();
    expect(thirdGranted).toBe(false);
    second();
  });

  it('setConcurrency up wakes waiters now', async () => {
    const scheduler = createScheduler(1);
    await scheduler.acquireSlot(never);
    let granted = false;
    void scheduler.acquireSlot(never).then(() => (granted = true));
    await settle();
    expect(granted).toBe(false);
    scheduler.setConcurrency(2);
    await settle();
    expect(granted).toBe(true);
  });

  it('setConcurrency down keeps running jobs and holds new ones until slots free', async () => {
    const scheduler = createScheduler(3);
    const releases = await Promise.all([1, 2, 3].map(() => scheduler.acquireSlot(never)));
    scheduler.setConcurrency(1);
    let granted = false;
    void scheduler.acquireSlot(never).then(() => (granted = true));
    releases[0]?.();
    releases[1]?.();
    await settle();
    expect(granted).toBe(false); // one still running, limit is 1
    releases[2]?.();
    await settle();
    expect(granted).toBe(true);
  });
});
