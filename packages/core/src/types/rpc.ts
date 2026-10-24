import type { CoreError } from './errors.ts';

export const RPC_METHODS = [
  'init',
  'detect',
  'targets',
  'plan',
  'submit',
  'cancel',
  'cancelAll',
  'engines.list',
  'engines.refresh',
  'engines.install',
  'settings.apply',
  'shutdown',
] as const;
export type RpcMethod = (typeof RPC_METHODS)[number];

export const RPC_EVENTS = [
  'ready',
  'job.update',
  'engines.changed',
  'engine.install.progress',
  'log',
] as const;
export type RpcEvent = (typeof RPC_EVENTS)[number];

export type RpcMessage =
  | { kind: 'req'; id: number; method: RpcMethod; params: unknown }
  | { kind: 'res'; id: number; ok: true; result: unknown }
  | { kind: 'res'; id: number; ok: false; error: CoreError }
  | { kind: 'evt'; name: RpcEvent; data: unknown };
