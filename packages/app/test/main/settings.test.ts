import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  mergeSettings,
  parseSettings,
} from '../../src/main/settings.ts';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filecon-settings-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const withUi = (ui: Record<string, unknown>) => ({
  ...DEFAULT_SETTINGS,
  ui: { ...DEFAULT_SETTINGS.ui, ...ui },
});

describe('load and save', () => {
  it('gives the defaults when there is no file, and round-trips a save', async () => {
    const warnings: string[] = [];
    const store = await loadSettings({ dir, warn: (message) => warnings.push(message) });
    expect(store.current()).toEqual(DEFAULT_SETTINGS);

    const changed = withUi({ accent: 'green', theme: 'dark' });
    await store.save(changed);
    expect((await loadSettings({ dir, warn: () => undefined })).current()).toEqual(changed);
    expect(await readdir(dir)).toEqual(['settings.json']);
    expect(warnings).toEqual([]);
  });

  it('moves a corrupt file to settings.bad.json and uses the defaults', async () => {
    await writeFile(join(dir, 'settings.json'), '{ not json');
    const warnings: string[] = [];
    const store = await loadSettings({ dir, warn: (message) => warnings.push(message) });
    expect(store.current()).toEqual(DEFAULT_SETTINGS);
    expect((await readdir(dir)).sort()).toEqual(['settings.bad.json']);
    expect(warnings).toHaveLength(1);
  });

  it('moves a file with invalid values (unknown accent) aside too', async () => {
    await writeFile(join(dir, 'settings.json'), JSON.stringify(withUi({ accent: 'pink' })));
    const store = await loadSettings({ dir, warn: () => undefined });
    expect(store.current()).toEqual(DEFAULT_SETTINGS);
    expect(await readdir(dir)).toContain('settings.bad.json');
  });

  it('uses the defaults for a newer version and leaves the file alone', async () => {
    const newer = JSON.stringify({ ...DEFAULT_SETTINGS, version: 2 });
    await writeFile(join(dir, 'settings.json'), newer);
    const store = await loadSettings({ dir, warn: () => undefined });
    expect(store.current()).toEqual(DEFAULT_SETTINGS);
    expect(await readFile(join(dir, 'settings.json'), 'utf8')).toBe(newer);
    expect(await readdir(dir)).toEqual(['settings.json']);
  });
});

describe('parseSettings', () => {
  it('accepts the defaults and drops unknown keys', () => {
    const noisy = { ...DEFAULT_SETTINGS, extra: 1, ui: { ...DEFAULT_SETTINGS.ui, other: true } };
    expect(parseSettings(noisy)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps output.dir only for custom mode', () => {
    const custom = { ...DEFAULT_SETTINGS, output: { mode: 'custom', dir: '/out' } };
    expect(parseSettings(custom)?.output).toEqual({ mode: 'custom', dir: '/out' });
    const source = { ...DEFAULT_SETTINGS, output: { mode: 'source', dir: '/out' } };
    expect(parseSettings(source)?.output).toEqual({ mode: 'source' });
  });
});

describe('mergeSettings', () => {
  it('merges a partial patch one level deep', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { ui: { accent: 'purple' }, concurrency: 4 });
    expect(merged).toEqual({
      ...DEFAULT_SETTINGS,
      concurrency: 4,
      ui: { ...DEFAULT_SETTINGS.ui, accent: 'purple' },
    });
  });

  it('rejects a patch that makes the result invalid, and a non-object patch', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { ui: { language: 'xx' } })).toBeUndefined();
    expect(mergeSettings(DEFAULT_SETTINGS, 'nope')).toBeUndefined();
  });
});
