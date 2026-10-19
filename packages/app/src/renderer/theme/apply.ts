import type { Accent, Locale, Settings } from '@filecon/core/types';
import { ACCENT_TOKENS, BASE_TOKENS, type Mode } from './tokens.ts';

const RIGHT_TO_LEFT = new Set(['ar', 'he', 'fa', 'ur']);

export const resolveMode = (theme: Settings['ui']['theme'], prefersDark: boolean): Mode =>
  theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

export interface ThemeInput {
  root: HTMLElement;
  theme: Settings['ui']['theme'];
  accent: Accent;
  locale: Locale;
  prefersDark: boolean;
}

/** Writes the tokens and the four `<html>` attributes of CONTRACTS section 10. */
export const applyTheme = ({ root, theme, accent, locale, prefersDark }: ThemeInput): void => {
  const mode = resolveMode(theme, prefersDark);
  const tokens = { ...BASE_TOKENS[mode], ...ACCENT_TOKENS[mode][accent] };
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  root.dataset.theme = mode;
  root.dataset.accent = accent;
  root.lang = locale;
  root.dir = RIGHT_TO_LEFT.has(locale) ? 'rtl' : 'ltr';
};
