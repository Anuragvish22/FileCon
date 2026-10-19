// Mirror of docs/CONTRACTS.md section 6. Change both together.

import type { CoreError } from './errors.ts';

export type RpcMessage =
  | { kind: 'req'; id: number; method: RpcMethod; params: unknown }
  | { kind: 'res'; id: number; ok: true; result: unknown }
  | { kind: 'res'; id: number; ok: false; error: CoreError }
  | { kind: 'evt'; name: RpcEvent; data: unknown };

// The names in the tables below
export type RpcMethod =
  | 'init'
  | 'detect'
  | 'targets'
  | 'plan'
  | 'submit'
  | 'cancel'
  | 'cancelAll'
  | 'engines.list'
  | 'engines.refresh'
  | 'engines.install'
  | 'settings.apply'
  | 'shutdown';
export type RpcEvent =
  'ready' | 'job.update' | 'engines.changed' | 'engine.install.progress' | 'log';
