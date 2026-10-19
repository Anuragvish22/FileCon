const BYTES_PER_MB = 1_000_000;
const MS_PER_MB = 4_000;
const CEILING_MINUTES = 30;
const MS_PER_MINUTE = 60_000;
const CEILING_MS = CEILING_MINUTES * MS_PER_MINUTE;

/**
 * A step's time limit grows with its input, so a big document is not killed while it is still working
 * (a hung engine still is). shortcut: 4 s per MB is a guess, not a measurement. M1-4c saw a 3,946-page
 * text docx finish in 94 s; tune it when a slower machine or a heavier file times out.
 */
export const scaledTimeout = (baseMs: number, inputBytes: number): number =>
  Math.min(
    baseMs + Math.floor(inputBytes / BYTES_PER_MB) * MS_PER_MB,
    Math.max(baseMs, CEILING_MS),
  );
