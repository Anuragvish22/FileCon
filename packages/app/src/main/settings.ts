import { readFile, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { Accent, Locale, Settings } from '@filecon/core/types';

// CONTRACTS section 8 and section 10. The lists are runtime copies of the type unions.
const ACCENTS: readonly Accent[] = ['blue', 'green', 'purple', 'orange'];
const LOCALES: readonly Locale[] = ['en'];
const THEMES: readonly Settings['ui']['theme'][] = ['system', 'light', 'dark'];
const MAX_CONCURRENCY = 32;
const SETTINGS_VERSION = 1;
const JSON_INDENT = 2;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  output: { mode: 'source' },
  concurrency: 'auto',
  engines: { paths: {}, priority: [] },
  ui: { theme: 'system', accent: 'blue', language: 'system' },
};

type Fields = Record<string, unknown>;

const fieldsOf = (value: unknown): Fields | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Fields)
    : undefined;

const oneOf = <Item extends string>(allowed: readonly Item[], value: unknown): Item | undefined =>
  allowed.find((item) => item === value);

const isAbsolutePath = (value: unknown): value is string =>
  typeof value === 'string' && isAbsolute(value);

/**
 * The full check. Builds a new object from known fields only, so unknown keys are dropped.
 * Returns undefined when anything is invalid.
 */
export const parseSettings = (value: unknown): Settings | undefined => {
  const settings = fieldsOf(value);
  const output = fieldsOf(settings?.output);
  const engines = fieldsOf(settings?.engines);
  const paths = fieldsOf(engines?.paths);
  const ui = fieldsOf(settings?.ui);
  if (settings === undefined || output === undefined || engines === undefined) return undefined;
  if (paths === undefined || ui === undefined || settings.version !== SETTINGS_VERSION)
    return undefined;

  const { concurrency } = settings;
  const concurrencyValid =
    concurrency === 'auto' ||
    (typeof concurrency === 'number' &&
      Number.isInteger(concurrency) &&
      concurrency >= 1 &&
      concurrency <= MAX_CONCURRENCY);
  const mode = oneOf(['source', 'custom'], output.mode);
  const theme = oneOf(THEMES, ui.theme);
  const accent = oneOf(ACCENTS, ui.accent);
  const language = ui.language === 'system' ? 'system' : oneOf(LOCALES, ui.language);
  const { priority } = engines;
  if (!concurrencyValid || mode === undefined || theme === undefined) return undefined;
  if (accent === undefined || language === undefined) return undefined;
  if (!Array.isArray(priority) || !priority.every((item) => typeof item === 'string'))
    return undefined;
  const pathEntries = Object.entries(paths);
  if (!pathEntries.every(([, path]) => isAbsolutePath(path))) return undefined;
  if (mode === 'custom' && !isAbsolutePath(output.dir)) return undefined;

  return {
    version: SETTINGS_VERSION,
    output: mode === 'custom' ? { mode, dir: output.dir as string } : { mode },
    concurrency,
    engines: {
      paths: Object.fromEntries(pathEntries) as Record<string, string>,
      priority,
    },
    ui: { theme, accent, language },
  };
};

/** Applies a partial patch one level deep (output, engines and ui merge by field), then validates. */
export const mergeSettings = (current: Settings, patch: unknown): Settings | undefined => {
  const changes = fieldsOf(patch);
  if (changes === undefined) return undefined;
  const merged: Fields = { ...current };
  for (const [key, change] of Object.entries(changes)) {
    const group = fieldsOf(change);
    const existing = fieldsOf(merged[key]);
    merged[key] =
      group !== undefined && existing !== undefined ? { ...existing, ...group } : change;
  }
  return parseSettings(merged);
};

export interface SettingsStore {
  /** Settings as last loaded or saved. */
  current(): Settings;
  save(settings: Settings): Promise<void>;
}

interface LoadInput {
  dir: string;
  warn: (message: string) => void;
}

const FILE = 'settings.json';
const BAD_FILE = 'settings.bad.json';

/**
 * Loads `<dir>/settings.json`. Invalid JSON or values move the file to `settings.bad.json` and give the
 * defaults. A newer `version` gives the defaults too, but the file stays and is not written until the
 * user changes something (CONTRACTS section 8).
 */
export const loadSettings = async ({ dir, warn }: LoadInput): Promise<SettingsStore> => {
  const file = join(dir, FILE);
  let current = DEFAULT_SETTINGS;
  const raw = await readFile(file, 'utf8').catch(() => undefined);
  if (raw !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
    const version = fieldsOf(parsed)?.version;
    const valid = parseSettings(parsed);
    if (valid !== undefined) current = valid;
    else if (typeof version === 'number' && version > SETTINGS_VERSION)
      warn('settings.json is from a newer version, using defaults');
    else {
      warn('settings.json is invalid, moved to settings.bad.json');
      await rename(file, join(dir, BAD_FILE));
    }
  }
  return {
    current: () => current,
    async save(settings) {
      // Settings are app-owned, so replacing the file is fine here (unlike outputs).
      const temp = `${file}.tmp`;
      await writeFile(temp, JSON.stringify(settings, null, JSON_INDENT));
      await rename(temp, file);
      current = settings;
    },
  };
};
