// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyTheme, resolveMode } from '../../src/renderer/theme/apply.ts';
import { ACCENTS, contrast, rolesOf, type Mode } from '../../src/renderer/theme/tokens.ts';

const MODES: Mode[] = ['light', 'dark'];
const STATUSES = ['success', 'warning', 'info', 'danger'];
const MIN_PAIRS = 40;

// UI-DESIGN section 8.4 is the spec: the test runs every row of its table.
const design = readFileSync(
  join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'UI-DESIGN.md'),
  'utf8',
);
const section = (heading: string): string =>
  design.split(heading)[1]?.split(/^### 8\.\d+ /m)[0] ?? '';
const PAIR_ROW = /^\| `([\w-]+)` on `([\w-]+)` \| ([\d.]+):1 \|/gm;
const pairs = [...section('### 8.4 Contrast (enforced by test)').matchAll(PAIR_ROW)].map((row) => ({
  text: `--${row[1]}`,
  background: `--${row[2]}`,
  target: Number(row[3]),
}));

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('roles (UI-DESIGN section 8.3)', () => {
  it('defines every role of the table, for every mode and accent', () => {
    const listed = [...section('### 8.3 Roles').matchAll(/^\| `(--[\w<>-]+)`/gm)].map(
      (row) => row[1] ?? '',
    );
    const expected = listed.flatMap((name) =>
      name.includes('<status>')
        ? STATUSES.map((status) => name.replace('<status>', status))
        : [name],
    );
    expect(expected.length).toBeGreaterThan(MIN_PAIRS / 2);
    for (const mode of MODES)
      for (const accent of ACCENTS) {
        const roles = rolesOf(mode, accent);
        for (const name of expected) expect(roles[name], `${mode} ${accent} ${name}`).toBeDefined();
      }
  });
});

describe.each(MODES)('%s mode contrast table', (mode) => {
  it('has the rows of section 8.4', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(MIN_PAIRS);
  });

  it.each(ACCENTS)('every pair meets its target with the %s accent', (accent) => {
    const roles = rolesOf(mode, accent);
    for (const { text, background, target } of pairs) {
      const textColor = roles[text];
      const backgroundColor = roles[background];
      expect(textColor, `${text} is a role`).toBeDefined();
      expect(backgroundColor, `${background} is a role`).toBeDefined();
      expect(
        contrast(textColor ?? '', backgroundColor ?? ''),
        `${mode} ${accent}: ${text} on ${background}`,
      ).toBeGreaterThanOrEqual(target);
    }
  });
});

describe('applyTheme', () => {
  it('sets the tokens and the html attributes', () => {
    const root = document.createElement('html');
    applyTheme({ root, theme: 'dark', accent: 'green', locale: 'en', prefersDark: false });
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.accent).toBe('green');
    expect(root.lang).toBe('en');
    expect(root.dir).toBe('ltr');
    expect(root.style.getPropertyValue('--accent')).toBe(rolesOf('dark', 'green')['--accent']);
    expect(root.style.getPropertyValue('--swatch-blue')).toBe(rolesOf('dark', 'blue')['--accent']);
  });

  it('follows the OS when the theme is system', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
  });
});
