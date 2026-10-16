// Mirror of docs/CONTRACTS.md section 5. Change both together.

export interface CoreError {
  code: ErrorCode;
  params: Record<string, string | number>; // fills the text t("error.<code>", params). No prose (section 10)
  detail?: string; // engine stderr tail ≤ 2 KB, or technical cause. Shown raw, never translated
  input?: string; // which input path this concerns
}

// Runtime list so tests can enumerate the codes. Same order as the table below.
export const ERROR_CODES = [
  'INVALID_REQUEST',
  'INPUT_NOT_FOUND',
  'INPUT_UNREADABLE',
  'EMPTY_FILE',
  'UNSUPPORTED_FORMAT',
  'INPUT_ENCRYPTED',
  'NO_ROUTE',
  'ENGINE_MISSING',
  'ENGINE_FAILED',
  'ENGINE_OUTPUT_MISSING',
  'TIMEOUT',
  'CANCELLED',
  'OUTPUT_DIR_NOT_WRITABLE',
  'OUTPUT_WRITE_FAILED',
  'DISK_FULL',
  'CORE_CRASHED',
  'CORE_UNAVAILABLE',
  'NOTHING_TO_EXTRACT',
  'INSTALL_FAILED',
  'CHECKSUM_MISMATCH',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
