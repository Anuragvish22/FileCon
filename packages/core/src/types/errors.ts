import { z } from 'zod';

// Same order as the table in CONTRACTS section 5.
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
  'CORE_TIMEOUT',
  'NOTHING_TO_EXTRACT',
  'INSTALL_FAILED',
  'CHECKSUM_MISMATCH',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const CoreErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  params: z.record(z.string(), z.union([z.string(), z.number()])), // fills the text translate("error.<code>", params). No prose (CONTRACTS section 10)
  detail: z.string().optional(), // engine stderr tail ≤ 2 KB, or technical cause. Shown raw, never translated
  input: z.string().optional(), // which input path this concerns
});
export type CoreError = z.infer<typeof CoreErrorSchema>;
