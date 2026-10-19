// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyTheme, resolveMode } from '../../src/renderer/theme/apply.ts';
import {
  ACCENT_TOKENS,
  ACCENTS,
  BASE_TOKENS,
  contrast,
  type Mode,
} from '../../src/renderer/theme/tokens.ts';

const MODES: Mode[] = ['light', 'dark'];
const READABLE = 4.5; // WCAG AA for normal text

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe.each(MODES)('%s mode', (mode) => {
  const base = BASE_TOKENS[mode];
  it('text and muted text are readable on the background and the surface', () => {
    for (const text of ['--fg', '--muted', '--danger']) {
      expect(contrast(base[text] ?? '', base['--bg'] ?? '')).toBeGreaterThanOrEqual(READABLE);
      expect(contrast(base[text] ?? '', base['--surface'] ?? '')).toBeGreaterThanOrEqual(READABLE);
    }
  });

  it.each(ACCENTS)(
    '%s accent is readable as text and carries readable text as a fill',
    (accent) => {
      const tokens = ACCENT_TOKENS[mode][accent];
      expect(contrast(tokens['--accent'], base['--bg'] ?? '')).toBeGreaterThanOrEqual(READABLE);
      expect(contrast(tokens['--accent-fg'], tokens['--accent'])).toBeGreaterThanOrEqual(READABLE);
    },
  );
});

describe('applyTheme', () => {
  it('sets the tokens and the html attributes', () => {
    const root = document.createElement('html');
    applyTheme({ root, theme: 'dark', accent: 'green', locale: 'en', prefersDark: false });
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.accent).toBe('green');
    expect(root.lang).toBe('en');
    expect(root.dir).toBe('ltr');
    expect(root.style.getPropertyValue('--accent')).toBe(ACCENT_TOKENS.dark.green['--accent']);
  });

  it('follows the OS when the theme is system', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
  });
});
