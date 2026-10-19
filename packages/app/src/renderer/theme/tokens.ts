import type { Accent } from '@filecon/core/types';

// The only place raw colors may appear (ARCHITECTURE section 13). Components use `var(--…)`.
export type Mode = 'light' | 'dark';

export const BASE_TOKENS: Record<Mode, Record<string, string>> = {
  light: {
    '--bg': '#ffffff',
    '--surface': '#f4f5f7',
    '--fg': '#1a1c21',
    '--muted': '#575d6b',
    '--border': '#c9ced8',
    '--danger': '#b3261e',
  },
  dark: {
    '--bg': '#15171c',
    '--surface': '#1f2229',
    '--fg': '#eceff4',
    '--muted': '#a3abbb',
    '--border': '#3a3f4b',
    '--danger': '#ff8a80',
  },
};

// `--accent` is used as text and as a fill; `--accent-fg` is the text drawn on that fill.
export const ACCENT_TOKENS: Record<
  Mode,
  Record<Accent, { '--accent': string; '--accent-fg': string }>
> = {
  light: {
    blue: { '--accent': '#1d4ed8', '--accent-fg': '#ffffff' },
    green: { '--accent': '#15803d', '--accent-fg': '#ffffff' },
    purple: { '--accent': '#7e22ce', '--accent-fg': '#ffffff' },
    orange: { '--accent': '#b45309', '--accent-fg': '#ffffff' },
  },
  dark: {
    blue: { '--accent': '#7aa2ff', '--accent-fg': '#0b0d11' },
    green: { '--accent': '#4ade80', '--accent-fg': '#0b0d11' },
    purple: { '--accent': '#c4a1ff', '--accent-fg': '#0b0d11' },
    orange: { '--accent': '#fb923c', '--accent-fg': '#0b0d11' },
  },
};

export const ACCENTS: readonly Accent[] = ['blue', 'green', 'purple', 'orange'];

const CHANNELS = 3;
const HEX_RADIX = 16;
const BYTE_MAX = 255;
const LINEAR_CUTOFF = 0.039_28;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA = 2.4;
const RED_WEIGHT = 0.2126; // WCAG relative luminance weights
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;
const LUMA_WEIGHTS = [RED_WEIGHT, GREEN_WEIGHT, BLUE_WEIGHT] as const;
const HEX_PAIR = 2;
const AFTER_HASH = 1;
const GLARE_FLOOR = 0.05;

const luminance = (hex: string): number => {
  let total = 0;
  for (let channel = 0; channel < CHANNELS; channel += 1) {
    const value =
      Number.parseInt(
        hex.slice(AFTER_HASH + channel * HEX_PAIR, AFTER_HASH + (channel + 1) * HEX_PAIR),
        HEX_RADIX,
      ) / BYTE_MAX;
    const linear =
      value <= LINEAR_CUTOFF
        ? value / LINEAR_DIVISOR
        : ((value + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA;
    total += linear * (LUMA_WEIGHTS[channel] ?? 0);
  }
  return total;
};

/** WCAG contrast ratio between two `#rrggbb` colors. */
export const contrast = (first: string, second: string): number => {
  const lights = [luminance(first), luminance(second)];
  const light = Math.max(...lights);
  const dark = Math.min(...lights);
  return (light + GLARE_FLOOR) / (dark + GLARE_FLOOR);
};
