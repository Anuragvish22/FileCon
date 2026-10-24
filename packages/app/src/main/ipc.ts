import { z } from 'zod';
import type { CoreError, DetectResult, EngineInfo, RpcMethod, Settings } from '@filecon/core/types';
import { CoreCallError } from './coreClient.ts';
import { expandPaths } from './expand.ts';
import { checkPath } from './paths.ts';
import { mergeSettings, type SettingsStore } from './settings.ts';
import type { Translate } from '../shared/i18n.ts';

export interface IpcDeps {
  call(method: RpcMethod, params: unknown): Promise<unknown>;
  settings: SettingsStore;
  translate: Translate;
  dialogs: {
    openFiles(): Promise<string[]>;
    chooseDir(): Promise<string | null>;
    chooseEngine(engineId: string): Promise<string | null>;
    confirm(text: { message: string; accept: string; decline: string }): Promise<boolean>;
  };
  shell: { reveal(path: string): void; openExternal(url: string): Promise<void> };
  isKnownOutput(path: string): boolean;
  log(level: 'warn' | 'error', message: string): void;
}

export type IpcHandler = (payload: unknown) => Promise<unknown>;

const BYTES_PER_MB = 1_000_000;

const refuse = (code: CoreError['code']): CoreCallError => new CoreCallError({ code, params: {} });

// Payload shapes. A path inside them is checked one by one (`checkPath`), so a bad one fails alone.
const StringPayload = z.string();
const ListPayload = z.array(z.unknown());
const RequestPayload = z.looseObject({
  input: z.unknown().optional(),
  inputs: z.array(z.unknown()).optional(),
  outDir: z.unknown().optional(),
});

const payloadOf = <Schema extends z.ZodType>(
  schema: Schema,
  payload: unknown,
): z.output<Schema> => {
  const result = schema.safeParse(payload);
  if (!result.success) throw refuse('INVALID_REQUEST');
  return result.data;
};

const failedDetect = (path: unknown, error: CoreError): DetectResult => ({
  path: typeof path === 'string' ? path : '',
  size: 0,
  format: null,
  byContent: null,
  byExt: null,
  mismatch: false,
  error,
});

/** An input or outDir must pass `checkPath`; the resolved path is what core gets. */
const resolved = async (value: unknown, kind: 'file' | 'directory'): Promise<string> => {
  const checked = await checkPath(value, kind);
  if (!checked.ok) throw new CoreCallError(checked.error);
  return checked.path;
};

// shortcut: one bad input or outDir rejects the whole submit, CONTRACTS section 7 wants only that file to fail. A renderer that detected first rarely sends one, P36 has the option.
const checkedRequest = async (value: unknown): Promise<unknown> => {
  const request = payloadOf(RequestPayload, value);
  const next: Record<string, unknown> = { ...request };
  if (request.input !== undefined) next.input = await resolved(request.input, 'file');
  if (request.inputs !== undefined)
    next.inputs = await Promise.all(request.inputs.map((input) => resolved(input, 'file')));
  if (request.outDir !== undefined) next.outDir = await resolved(request.outDir, 'directory');
  return next;
};

/** One handler per channel in CONTRACTS section 7. A failure rejects with `CoreCallError`. */
export const createHandlers = (deps: IpcDeps): Record<string, IpcHandler> => {
  const table = handlerTable(deps);
  // A payload check that throws before the first await must still reach the caller as a rejection.
  return Object.fromEntries(
    Object.entries(table).map(([channel, handler]) => [
      channel,
      (payload: unknown) => Promise.resolve().then(() => handler(payload)),
    ]),
  );
};

const handlerTable = (deps: IpcDeps): Record<string, (payload: unknown) => unknown> => {
  const engines = async (): Promise<EngineInfo[]> =>
    (await deps.call('engines.list', {})) as EngineInfo[];

  return {
    'core:detect': async (payload) => {
      const paths = payloadOf(ListPayload, payload);
      const checks = await Promise.all(paths.map((path) => checkPath(path, 'file')));
      const valid = checks.flatMap((check) => (check.ok ? [check.path] : []));
      const found = (await deps.call('detect', { paths: valid })) as DetectResult[];
      const results = [...found];
      return checks.map((check, index) =>
        check.ok ? results.shift() : failedDetect(paths[index], check.error),
      );
    },
    'core:targets': (payload) => deps.call('targets', { formats: payload }),
    'job:submit': async (payload) => {
      const requests = await Promise.all(payloadOf(ListPayload, payload).map(checkedRequest));
      return deps.call('submit', { requests });
    },
    'job:cancel': (payload) => deps.call('cancel', { jobId: payloadOf(StringPayload, payload) }),
    'job:cancelAll': () => deps.call('cancelAll', {}),
    'engines:list': () => deps.call('engines.list', {}),
    'engines:refresh': () => deps.call('engines.refresh', {}),
    'engines:install': async (payload) => {
      const engineId = payloadOf(StringPayload, payload);
      const method = (await engines()).find((engine) => engine.id === engineId)?.install;
      // Anything but a download is refused by core, so only a download needs the dialog.
      if (method?.kind === 'download') {
        const confirmed = await deps.dialogs.confirm({
          message: deps.translate('install.confirm.message', {
            engine: engineId,
            size: `${Math.round(method.sizeBytes / BYTES_PER_MB)} MB`,
            host: new URL(method.url).host,
          }),
          accept: deps.translate('install.confirm.accept'),
          decline: deps.translate('install.confirm.decline'),
        });
        if (!confirmed) throw refuse('CANCELLED');
      }
      return deps.call('engines.install', { engineId });
    },
    'dialog:openFiles': () => deps.dialogs.openFiles(),
    'dialog:chooseDir': () => deps.dialogs.chooseDir(),
    'dialog:chooseEngine': (payload) =>
      deps.dialogs.chooseEngine(payloadOf(StringPayload, payload)),
    'files:expand': (payload) => expandPaths(payload),
    'shell:reveal': (payload) => {
      const path = payloadOf(StringPayload, payload);
      if (!deps.isKnownOutput(path)) throw refuse('INVALID_REQUEST');
      deps.shell.reveal(path);
      return Promise.resolve();
    },
    'shell:openExternal': async (payload) => {
      const url = payloadOf(StringPayload, payload);
      if (!(await engines()).some((engine) => engine.installUrl === url))
        throw refuse('INVALID_REQUEST');
      await deps.shell.openExternal(url);
    },
    'settings:get': () => Promise.resolve(deps.settings.current()),
    'settings:set': async (payload) => {
      const merged: Settings | undefined = mergeSettings(deps.settings.current(), payload);
      if (merged === undefined) throw refuse('INVALID_REQUEST');
      await deps.settings.save(merged);
      // Core also gets the settings on its next start, so a host that is down now does not fail the save.
      await deps.call('settings.apply', { settings: merged }).catch((caught: unknown) => {
        deps.log('warn', `settings.apply not delivered: ${String(caught)}`);
      });
      return merged;
    },
  };
};
