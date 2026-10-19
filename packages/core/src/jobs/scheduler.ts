import { CoreFailure } from '../errors.ts';

// ARCHITECTURE section 9.
export type Release = () => void;

interface Waiter {
  grant(): void;
}

/** A counting semaphore with a FIFO queue, where a waiter can leave the queue by aborting. */
const createGate = (initialLimit: number) => {
  let limit = initialLimit;
  let active = 0;
  const queue: Waiter[] = [];

  const drain = (): void => {
    while (active < limit) {
      const next = queue.shift();
      if (next === undefined) return;
      active += 1;
      next.grant();
    }
  };

  const takeRelease = (): Release => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active -= 1;
      drain();
    };
  };

  return {
    acquire: (signal: AbortSignal): Promise<Release> =>
      new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new CoreFailure('CANCELLED'));
          return;
        }
        const onAbort = (): void => {
          queue.splice(queue.indexOf(waiter), 1);
          reject(new CoreFailure('CANCELLED'));
        };
        const waiter: Waiter = {
          grant: () => {
            signal.removeEventListener('abort', onAbort);
            resolve(takeRelease());
          },
        };
        queue.push(waiter);
        signal.addEventListener('abort', onAbort, { once: true });
        drain();
      }),
    setLimit: (next: number): void => {
      limit = next;
      drain();
    },
  };
};

export interface ConverterSlot {
  converterId: string;
  max: number | undefined; // Converter.maxConcurrent, undefined = unlimited
  signal: AbortSignal;
}

export interface Scheduler {
  /** Global slot. A job holds it from running until it is terminal. Rejects CANCELLED if `signal` aborts first. */
  acquireSlot(signal: AbortSignal): Promise<Release>;
  /** The converter's own limit (LibreOffice = 1), held for one step. */
  acquireConverter(slot: ConverterSlot): Promise<Release>;
  /** Raising wakes waiters now. Lowering applies as slots free up: running jobs are never interrupted. */
  setConcurrency(slotCount: number): void;
}

export const createScheduler = (slotCount: number): Scheduler => {
  const slots = createGate(slotCount);
  const converters = new Map<string, ReturnType<typeof createGate>>();
  return {
    acquireSlot: (signal) => slots.acquire(signal),
    acquireConverter: ({ converterId, max, signal }) => {
      if (max === undefined) {
        return signal.aborted
          ? Promise.reject(new CoreFailure('CANCELLED'))
          : Promise.resolve(() => undefined);
      }
      let gate = converters.get(converterId);
      if (gate === undefined) {
        gate = createGate(max);
        converters.set(converterId, gate);
      }
      return gate.acquire(signal);
    },
    setConcurrency: (next) => slots.setLimit(next),
  };
};
