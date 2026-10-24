import { z } from 'zod';
import { canonical } from '../formats.ts';
import { invalidRequest } from '../options.ts';
import {
  JobRequestSchema,
  RPC_METHODS,
  SettingsSchema,
  type CoreError,
  type RpcMessage,
  type RpcMethod,
} from '../types/index.ts';

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

// An alias like "jpeg" becomes its canonical id, an unknown name fails.
const canonicalFormat = (name: string, context: z.RefinementCtx): string => {
  const format = canonical(name);
  if (format === null) context.addIssue({ code: 'custom', message: 'unknown-format' });
  return format ?? name;
};

const FormatSchema = z.string().min(1).transform(canonicalFormat);

// shortcut: extract jobs arrive with M1.1-3, until then they are refused like any unknown kind
const RequestSchema = JobRequestSchema.refine((request) => request.kind !== 'extract').transform(
  (request, context) =>
    request.kind === 'convert'
      ? { ...request, target: canonicalFormat(request.target, context) }
      : request,
);

const Empty = z.object({});
const Path = z.string().min(1);

// CONTRACTS section 6. A malformed request carries no `what`, so the UI shows the generic text.
const PARAM_SCHEMAS = {
  init: z.object({ settings: SettingsSchema, dataDir: Path }),
  detect: z.object({ paths: z.array(Path) }),
  targets: z.object({ formats: z.array(FormatSchema) }),
  plan: z.object({ from: FormatSchema, to: FormatSchema }),
  submit: z.object({ requests: z.array(RequestSchema) }),
  cancel: z.object({ jobId: Path }),
  empty: Empty,
  engineInstall: z.object({ engineId: Path }),
  settingsApply: z.object({ settings: SettingsSchema }),
};

type ParamSchemas = typeof PARAM_SCHEMAS;

/** One parser per method: the typed params, or a thrown `CoreFailure` (INVALID_REQUEST). */
export const PARAMS = Object.fromEntries(
  Object.entries(PARAM_SCHEMAS).map(([name, schema]) => [
    name,
    (params: unknown) => {
      const result = schema.safeParse(params);
      if (!result.success) throw invalidRequest(result.error);
      return result.data;
    },
  ]),
) as { [Name in keyof ParamSchemas]: (params: unknown) => z.output<ParamSchemas[Name]> };

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
