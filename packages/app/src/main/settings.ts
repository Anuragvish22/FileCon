import { readFile, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { SETTINGS_VERSION, SettingsSchema, type Settings } from '@filecon/core/types';

const JSON_INDENT = 2;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  output: { mode: 'source' },
  concurrency: 'auto',
  engines: { paths: {}, priority: [] },
  ui: { theme: 'system', accent: 'teal', language: 'system' },
};

// Core takes any string for a path. Main is where a relative one is refused.
const AppSettingsSchema = SettingsSchema.refine(
  (settings) =>
    Object.values(settings.engines.paths).every((path) => isAbsolute(path)) &&
    (settings.output.mode !== 'custom' || isAbsolute(settings.output.dir ?? '')),
);

const FieldsSchema = z.record(z.string(), z.unknown());

/** The full check. Unknown keys are dropped. Returns undefined when anything is invalid. */
export const parseSettings = (value: unknown): Settings | undefined => {
  const result = AppSettingsSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

/** Applies a partial patch one level deep (output, engines and ui merge by field), then validates. */
export const mergeSettings = (current: Settings, patch: unknown): Settings | undefined => {
  const changes = FieldsSchema.safeParse(patch);
  if (!changes.success) return undefined;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, change] of Object.entries(changes.data)) {
    const group = FieldsSchema.safeParse(change);
    const existing = FieldsSchema.safeParse(merged[key]);
    merged[key] = group.success && existing.success ? { ...existing.data, ...group.data } : change;
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
    const version = z.object({ version: z.number() }).safeParse(parsed);
    const valid = parseSettings(parsed);
    if (valid !== undefined) current = valid;
    else if (version.success && version.data.version > SETTINGS_VERSION)
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
