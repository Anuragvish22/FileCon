import { ACCENTS as ACCENT_NAMES, type Accent } from '@filecon/core/types';

// The only place raw colors may appear (ARCHITECTURE section 13). Components use `var(--…)` roles.
// The values and their contrast are specified in UI-DESIGN section 8.
export type Mode = 'light' | 'dark';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
type Step = (typeof STEPS)[number];
type Ramp = Record<Step, string>;

const ramp = (...colors: string[]): Ramp =>
  Object.fromEntries(STEPS.map((step, index) => [step, colors[index] ?? ''])) as Ramp;

export const RAMPS = {
  neutral: ramp(
    '#f6f7f9',
    '#eceef2',
    '#dde0e7',
    '#c4c9d4',
    '#9aa1b0',
    '#717889',
    '#565d6e',
    '#3f4552',
    '#2a2e38',
    '#1c1f26',
    '#12141a',
  ),
  blue: ramp(
    '#eff6ff',
    '#dbeafe',
    '#bfdbfe',
    '#93c5fd',
    '#60a5fa',
    '#3b82f6',
    '#2563eb',
    '#1d4ed8',
    '#1e40af',
    '#1e3a8a',
    '#172554',
  ),
  green: ramp(
    '#f0fdf4',
    '#dcfce7',
    '#bbf7d0',
    '#86efac',
    '#4ade80',
    '#22c55e',
    '#16a34a',
    '#15803d',
    '#166534',
    '#14532d',
    '#052e16',
  ),
  purple: ramp(
    '#faf5ff',
    '#f3e8ff',
    '#e9d5ff',
    '#d8b4fe',
    '#c084fc',
    '#a855f7',
    '#9333ea',
    '#7e22ce',
    '#6b21a8',
    '#581c87',
    '#3b0764',
  ),
  orange: ramp(
    '#fff7ed',
    '#ffedd5',
    '#fed7aa',
    '#fdba74',
    '#fb923c',
    '#f97316',
    '#ea580c',
    '#c2410c',
    '#9a3412',
    '#7c2d12',
    '#431407',
  ),
  amber: ramp(
    '#fffbeb',
    '#fef3c7',
    '#fde68a',
    '#fcd34d',
    '#fbbf24',
    '#f59e0b',
    '#d97706',
    '#b45309',
    '#92400e',
    '#78350f',
    '#451a03',
  ),
  sky: ramp(
    '#f0f9ff',
    '#e0f2fe',
    '#bae6fd',
    '#7dd3fc',
    '#38bdf8',
    '#0ea5e9',
    '#0284c7',
    '#0369a1',
    '#075985',
    '#0c4a6e',
    '#082f49',
  ),
  red: ramp(
    '#fef2f2',
    '#fee2e2',
    '#fecaca',
    '#fca5a5',
    '#f87171',
    '#ef4444',
    '#dc2626',
    '#b91c1c',
    '#991b1b',
    '#7f1d1d',
    '#450a0a',
  ),
};

export type RampName = keyof typeof RAMPS;

// Status roles read these ramps (UI-DESIGN section 8.2).
const STATUS_RAMPS = {
  success: 'green',
  warning: 'amber',
  info: 'sky',
  danger: 'red',
} as const satisfies Record<string, RampName>;

export const ACCENTS: readonly Accent[] = ACCENT_NAMES;

const WHITE = '#ffffff';
const BLACK = '#000000';
const OVERLAY_ALPHA = { light: 0.5, dark: 0.6 };
const SHADOW_ALPHA = { light: 0.16, dark: 0.5 };
const withAlpha = (hex: string, alpha: number): string => {
  const [red, green, blue] = Array.from({ length: CHANNELS }, (_unused, channel) => channel).map(
    (channel) =>
      Number.parseInt(
        hex.slice(AFTER_HASH + channel * HEX_PAIR, AFTER_HASH + (channel + 1) * HEX_PAIR),
        HEX_RADIX,
      ),
  );
  return `rgb(${red} ${green} ${blue} / ${alpha})`;
};

/** Every role of UI-DESIGN section 8.3 for one mode and accent, as CSS variable name → color. */
export const rolesOf = (mode: Mode, accent: Accent): Record<string, string> => {
  const light = mode === 'light';
  const neutral = RAMPS.neutral;
  const accentRamp = RAMPS[accent];
  const roles: Record<string, string> = {
    '--bg': light ? WHITE : neutral['950'],
    '--surface': light ? neutral['50'] : neutral['900'],
    '--surface-raised': light ? WHITE : neutral['800'],
    '--border': light ? neutral['300'] : neutral['700'],
    '--border-strong': neutral['500'],
    '--fg': light ? neutral['900'] : neutral['50'],
    '--muted': light ? neutral['600'] : neutral['300'],
    '--fg-disabled': neutral['500'],
    '--accent': light ? accentRamp['700'] : accentRamp['400'],
    '--accent-hover': light ? accentRamp['800'] : accentRamp['300'],
    '--accent-subtle': light ? accentRamp['50'] : accentRamp['950'],
    '--accent-fg': light ? WHITE : neutral['950'],
    '--focus-ring': light ? accentRamp['700'] : accentRamp['400'],
    '--overlay': withAlpha(light ? neutral['950'] : BLACK, OVERLAY_ALPHA[mode]),
    '--shadow': withAlpha(light ? neutral['950'] : BLACK, SHADOW_ALPHA[mode]),
  };
  for (const [status, rampName] of Object.entries(STATUS_RAMPS)) {
    const statusRamp = RAMPS[rampName];
    roles[`--${status}`] = light ? statusRamp['700'] : statusRamp['300'];
    roles[`--${status}-subtle`] = light ? statusRamp['50'] : statusRamp['950'];
    roles[`--${status}-border`] = light ? statusRamp['300'] : statusRamp['800'];
  }
  return roles;
};

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
