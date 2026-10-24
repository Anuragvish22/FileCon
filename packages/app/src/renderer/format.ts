import { FORMATS, info } from '@filecon/core/formats';
import type { FormatCategory } from '@filecon/core/types';

export const categoryOf = (format: string): FormatCategory | undefined => info(format)?.category;

/** Every category the registry knows, in registry order (UI-DESIGN section 3: all of them always show). */
export const CATEGORIES: readonly FormatCategory[] = [
  ...new Set(FORMATS.map((format) => format.category)),
];

const OFFICE_CATEGORIES: readonly (FormatCategory | undefined)[] = [
  'document',
  'spreadsheet',
  'presentation',
];

/** P9: office files rendered to pdf can show boxes for scripts the machine has no font for. */
export const needsFontNote = (inputs: string[], target: string | null): boolean =>
  target === 'pdf' &&
  inputs.some((format) => format !== 'pdf' && OFFICE_CATEGORIES.includes(categoryOf(format)));

const BYTES_PER_STEP = 1000;
const SIZE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
const WHOLE_NUMBER_FROM = 100;

/** "2.1 MB" in the user's language: Intl owns the unit names, so no text lives in the catalog. */
export const humanSize = (bytes: number): string => {
  let value = bytes;
  let step = 0;
  while (value >= BYTES_PER_STEP && step < SIZE_UNITS.length - 1) {
    value /= BYTES_PER_STEP;
    step += 1;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: SIZE_UNITS[step] ?? 'byte',
    unitDisplay: 'short',
    maximumFractionDigits: step === 0 || value >= WHOLE_NUMBER_FROM ? 0 : 1,
  }).format(value);
};

export const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;
