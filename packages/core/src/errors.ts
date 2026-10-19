import type { CoreError, ErrorCode } from './types/index.ts';

// CONTRACTS section 5. page and count are the extra numbers `what: "page-past-end"` needs.
export type ErrorParam =
  'name' | 'engine' | 'pack' | 'from' | 'to' | 'dir' | 'what' | 'page' | 'count';
export type ErrorParams = Partial<Record<ErrorParam, string | number>>;

/** No prose here: the app renders t("error.<code>", params) (CONTRACTS section 10). */
export const coreError = (code: ErrorCode, params: ErrorParams = {}, detail?: string): CoreError =>
  detail === undefined ? { code, params } : { code, params, detail };

/** What core throws. Send only `.error` over RPC: structured clone drops an Error subclass's own fields. */
export class CoreFailure extends Error {
  override readonly name = 'CoreFailure';
  readonly error: CoreError;

  constructor(code: ErrorCode, params: ErrorParams = {}, detail?: string) {
    super(code);
    this.error = coreError(code, params, detail);
  }
}

/** What a Job carries after anything was thrown. A plain Error is an engine failure: nothing else can throw it. */
export const toCoreError = (caught: unknown): CoreError => {
  if (caught instanceof CoreFailure) return caught.error;
  if (caught instanceof Error) {
    if ((caught as NodeJS.ErrnoException).code === 'ENOSPC') return coreError('DISK_FULL');
    return coreError('ENGINE_FAILED', {}, caught.stack ?? caught.message);
  }
  return coreError('ENGINE_FAILED', {}, String(caught));
};
