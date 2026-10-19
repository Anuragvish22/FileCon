import { CoreFailure } from './errors.ts';
import type { ConvertOptions } from './types/index.ts';

// CONTRACTS section 2. Out-of-range values fail, they are never clamped.
const RANGES = {
  quality: { min: 1, max: 100 },
  dpi: { min: 72, max: 600 },
  width: { min: 1, max: 65535 },
  height: { min: 1, max: 65535 },
} as const;

const ENUMS = {
  pageSize: { what: 'page-size-value', allowed: ['auto', 'a4', 'letter'] },
  tiffCompression: { what: 'tiff-compression-value', allowed: ['lzw', 'deflate', 'jpeg', 'none'] },
} as const;

/** Throws INVALID_REQUEST with `what: "<option>-range"` or `"<option>-value"` (text: `invalid.<what>`). */
export const validateOptions = (options: ConvertOptions): void => {
  for (const [key, { min, max }] of Object.entries(RANGES)) {
    const value = options[key as keyof typeof RANGES];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < min || value > max)
      throw new CoreFailure('INVALID_REQUEST', { what: `${key}-range` });
  }
  for (const [key, { what, allowed }] of Object.entries(ENUMS)) {
    const value: unknown = options[key as keyof typeof ENUMS];
    if (value !== undefined && !(allowed as readonly unknown[]).includes(value))
      throw new CoreFailure('INVALID_REQUEST', { what });
  }
};
