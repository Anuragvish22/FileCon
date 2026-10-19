import { CoreFailure } from '../errors.ts';
import { canonical } from '../formats.ts';
import { validateOptions } from '../options.ts';
import type {
  CoreError,
  Format,
  JobRequest,
  RpcMessage,
  RpcMethod,
  Settings,
} from '../types/index.ts';

// CONTRACTS section 6. A malformed request carries no `what`, so the UI shows the generic text.
const malformed = (): CoreFailure => new CoreFailure('INVALID_REQUEST');

export const RPC_METHODS: readonly RpcMethod[] = [
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
];

export const isRpcMethod = (name: unknown): name is RpcMethod =>
  RPC_METHODS.some((method) => method === name);

/** A request envelope with a usable id. Anything else cannot be answered, so the server drops it. */
export const parseRequest = (
  message: unknown,
): { id: number; method: unknown; params: unknown } | null => {
  if (typeof message !== 'object' || message === null) return null;
  const envelope = message as Partial<Record<keyof Extract<RpcMessage, { kind: 'req' }>, unknown>>;
  if (envelope.kind !== 'req' || typeof envelope.id !== 'number') return null;
  return { id: envelope.id, method: envelope.method, params: envelope.params };
};

type Fields = Record<string, unknown>;

const fieldsOf = (params: unknown): Fields => {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) throw malformed();
  return params as Fields;
};

const stringOf = (value: unknown): string => {
  if (typeof value !== 'string' || value === '') throw malformed();
  return value;
};

const stringsOf = (value: unknown): string[] => {
  if (!Array.isArray(value)) throw malformed();
  return value.map(stringOf);
};

const formatOf = (value: unknown): Format => {
  const format = canonical(stringOf(value));
  if (format === null) throw malformed();
  return format;
};

const MAX_CONCURRENCY = 32;

// Main validates settings before sending (CONTRACTS section 8); core re-checks what it uses.
const settingsOf = (value: unknown): Settings => {
  const settings = fieldsOf(value);
  const output = fieldsOf(settings.output);
  const engines = fieldsOf(settings.engines);
  const { concurrency } = settings;
  const concurrencyValid =
    concurrency === 'auto' ||
    (typeof concurrency === 'number' &&
      Number.isInteger(concurrency) &&
      concurrency >= 1 &&
      concurrency <= MAX_CONCURRENCY);
  const modeValid = output.mode === 'source' || output.mode === 'custom';
  const dirValid = output.mode !== 'custom' || typeof output.dir === 'string';
  if (settings.version !== 1 || !concurrencyValid || !modeValid || !dirValid) throw malformed();
  const paths = fieldsOf(engines.paths);
  if (!Object.values(paths).every((path) => typeof path === 'string')) throw malformed();
  stringsOf(engines.priority);
  return value as Settings;
};

const requestOf = (value: unknown): JobRequest => {
  const request = fieldsOf(value);
  const options = fieldsOf(request.options);
  if (request.outDir !== undefined) stringOf(request.outDir);
  validateOptions(options);
  if (request.kind === 'convert') {
    stringOf(request.input);
    formatOf(request.target);
    return value as JobRequest;
  }
  if (request.kind === 'merge') {
    stringsOf(request.inputs);
    stringOf(request.combinerId);
    return value as JobRequest;
  }
  // shortcut: extract jobs arrive with M1.1-3, until then they are refused like any unknown kind
  throw malformed();
};

export const PARAMS = {
  init: (params: unknown): { settings: Settings; dataDir: string } => {
    const fields = fieldsOf(params);
    return { settings: settingsOf(fields.settings), dataDir: stringOf(fields.dataDir) };
  },
  detect: (params: unknown): { paths: string[] } => ({ paths: stringsOf(fieldsOf(params).paths) }),
  targets: (params: unknown): { formats: Format[] } => {
    const { formats } = fieldsOf(params);
    if (!Array.isArray(formats)) throw malformed();
    return { formats: formats.map(formatOf) };
  },
  plan: (params: unknown): { from: Format; to: Format } => {
    const fields = fieldsOf(params);
    return { from: formatOf(fields.from), to: formatOf(fields.to) };
  },
  submit: (params: unknown): { requests: JobRequest[] } => {
    const { requests } = fieldsOf(params);
    if (!Array.isArray(requests)) throw malformed();
    return { requests: requests.map(requestOf) };
  },
  cancel: (params: unknown): { jobId: string } => ({ jobId: stringOf(fieldsOf(params).jobId) }),
  empty: (params: unknown): Record<string, never> => {
    fieldsOf(params);
    return {};
  },
  engineInstall: (params: unknown): { engineId: string } => ({
    engineId: stringOf(fieldsOf(params).engineId),
  }),
  settingsApply: (params: unknown): { settings: Settings } => ({
    settings: settingsOf(fieldsOf(params).settings),
  }),
};

export const okResponse = (id: number, result: unknown): RpcMessage => ({
  kind: 'res',
  id,
  ok: true,
  result,
});

export const failResponse = (id: number, error: CoreError): RpcMessage => ({
  kind: 'res',
  id,
  ok: false,
  error,
});
