import type { CoreError, RpcEvent, RpcMessage, RpcMethod } from '@filecon/core/types';

/** What a failed call rejects with. Only `.error` is sent on to the renderer. */
export class CoreCallError extends Error {
  override readonly name = 'CoreCallError';
  readonly error: CoreError;

  constructor(error: CoreError) {
    super(error.code);
    this.error = error;
  }
}

// ARCHITECTURE section 12. These wait for the user or for running jobs, so no time limit. `init` is
// bounded by the supervisor's 15 s ready timer instead.
const UNLIMITED: readonly RpcMethod[] = ['init', 'submit', 'cancel', 'shutdown'];
const CALL_TIMEOUT_MS = 30_000;

type EventListener = (name: RpcEvent, data: unknown) => void;

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: CoreCallError) => void;
  timer: NodeJS.Timeout | undefined;
}

export interface CoreClient {
  call(method: RpcMethod, params: unknown): Promise<unknown>;
  /** Feed every message that arrives from the host. Anything that isn't a response or event is ignored. */
  receive(message: unknown): void;
  /** The host died: reject every pending call. */
  rejectAll(error: CoreError): void;
  onEvent(listener: EventListener): () => void;
}

/** One client per host instance, so ids are never reused for that host (CONTRACTS section 6). */
export const createCoreClient = ({ send }: { send: (message: RpcMessage) => void }): CoreClient => {
  let nextId = 1;
  const pending = new Map<number, Pending>();
  const listeners = new Set<EventListener>();

  const settle = (id: number): Pending | undefined => {
    const entry = pending.get(id);
    if (entry === undefined) return undefined;
    pending.delete(id);
    clearTimeout(entry.timer);
    return entry;
  };

  return {
    call(method, params) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = UNLIMITED.includes(method)
          ? undefined
          : setTimeout(() => {
              settle(id)?.reject(new CoreCallError({ code: 'CORE_TIMEOUT', params: {} }));
            }, CALL_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer });
        send({ kind: 'req', id, method, params });
      });
    },

    receive(message) {
      if (typeof message !== 'object' || message === null) return;
      const incoming = message as RpcMessage;
      if (incoming.kind === 'evt') {
        for (const listener of listeners) listener(incoming.name, incoming.data);
      } else if (incoming.kind === 'res') {
        // A late answer to a call that already timed out finds nothing and is dropped.
        const entry = settle(incoming.id);
        if (entry === undefined) return;
        if (incoming.ok) entry.resolve(incoming.result);
        else entry.reject(new CoreCallError(incoming.error));
      }
    },

    rejectAll(error) {
      for (const id of [...pending.keys()]) settle(id)?.reject(new CoreCallError(error));
    },

    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
