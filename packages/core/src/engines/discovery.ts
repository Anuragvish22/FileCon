import { access, constants, readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { posix, win32 } from 'node:path';
import { run } from '../jobs/spawn.ts';
import type { EngineInfo, EngineSpec } from '../types/index.ts';

// ARCHITECTURE section 11. Steps 3 (installed) and 7 (requiredBins) arrive with M1.1-4 and M1.1-2.
const PROBE_TIMEOUT_MS = 5000;
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';
const PROC_VERSION = '/proc/version';
const WSL_MARKER = /microsoft/i;
const WINDOWS_DRIVE_MOUNT = /^\/mnt\/[a-z]\//i;
// The id of a bundled engine is not always its npm package name.
const BUNDLED_PACKAGES: Readonly<Record<string, string>> = { sharp: 'sharp', pdflib: 'pdf-lib' };
type KnownPlatform = 'win32' | 'darwin' | 'linux';

/** Everything that touches the machine, so tests need no real binaries. */
export interface DiscoveryDeps {
  platform: NodeJS.Platform;
  env: Readonly<Record<string, string | undefined>>;
  /** A file we may run. A directory is not. */
  isExecutable(path: string): Promise<boolean>;
  listDir(dir: string): Promise<string[]>;
  readText(path: string): Promise<string | undefined>;
  /** Output of the process, stdout and stderr together. Rejects if it fails. */
  exec(path: string, args: readonly string[], timeoutMs: number): Promise<string>;
  bundledVersion(id: string): string | undefined;
}

export const realDeps: DiscoveryDeps = {
  platform: process.platform,
  env: process.env,
  isExecutable: async (path) => {
    try {
      if (!(await stat(path)).isFile()) return false;
      // Windows has no execute bit: a file with the right extension is what counts there.
      if (process.platform !== 'win32') await access(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  listDir: (dir) => readdir(dir).catch(() => []),
  readText: (path) => readFile(path, 'utf8').catch(() => undefined),
  exec: async (path, args, timeoutMs) => {
    const result = await run({
      bin: path,
      args,
      signal: new AbortController().signal,
      timeoutMs,
    });
    return `${result.stdoutTail}\n${result.stderrTail}`;
  },
  bundledVersion: (id) => {
    const name = BUNDLED_PACKAGES[id];
    if (name === undefined) return undefined;
    try {
      const manifest: unknown = createRequire(import.meta.url)(`${name}/package.json`);
      const version = (manifest as { version?: unknown }).version;
      return typeof version === 'string' ? version : undefined;
    } catch {
      return undefined; // shortcut: packages that hide package.json report no version, revisit at M1-4
    }
  },
};

const isKnownPlatform = (platform: NodeJS.Platform): platform is KnownPlatform =>
  platform === 'win32' || platform === 'darwin' || platform === 'linux';

const basicInfo = (spec: EngineSpec, platform: NodeJS.Platform): EngineInfo => {
  const install = isKnownPlatform(platform) ? spec.install?.[platform] : undefined;
  return {
    id: spec.id,
    pack: spec.pack,
    found: false,
    installUrl: spec.installUrl,
    ...(install === undefined ? {} : { install }),
  };
};

// Numeric-aware, so libreoffice24.8 sorts after libreoffice7.6.
const byVersion = (first: string, second: string): number =>
  first.localeCompare(second, undefined, { numeric: true });

/** Expands `*` inside one path segment, newest (last in sort order) first. */
const expandKnownPath = async (pattern: string, deps: DiscoveryDeps): Promise<string[]> => {
  if (!pattern.includes('*')) return [pattern];
  const api = deps.platform === 'win32' ? win32 : posix;
  const { root } = api.parse(pattern);
  let matches = [root];
  for (const segment of pattern.slice(root.length).split(api.sep)) {
    const next: string[] = [];
    if (segment.includes('*')) {
      const wanted = new RegExp(`^${segment.split('*').map(escapeRegExp).join('.*')}$`);
      for (const parent of matches)
        for (const name of (await deps.listDir(parent)).sort(byVersion).reverse())
          if (wanted.test(name)) next.push(api.join(parent, name));
    } else {
      for (const parent of matches) next.push(api.join(parent, segment));
    }
    matches = next;
  }
  return matches;
};

const escapeRegExp = (text: string): string => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

const pathCandidates = (spec: EngineSpec, deps: DiscoveryDeps): string[] => {
  if (!isKnownPlatform(deps.platform)) return [];
  const api = deps.platform === 'win32' ? win32 : posix;
  const dirs = (deps.env.PATH ?? deps.env.Path ?? '').split(api.delimiter).filter(Boolean);
  // Windows finds `soffice` as `soffice.EXE`: try every PATHEXT extension too.
  const extensions =
    deps.platform === 'win32' ? ['', ...(deps.env.PATHEXT ?? DEFAULT_PATHEXT).split(';')] : [''];
  const candidates: string[] = [];
  for (const name of spec.bins?.[deps.platform] ?? [])
    for (const dir of dirs)
      for (const extension of extensions) candidates.push(api.join(dir, `${name}${extension}`));
  return candidates;
};

const knownCandidates = async (spec: EngineSpec, deps: DiscoveryDeps): Promise<string[]> => {
  if (!isKnownPlatform(deps.platform)) return [];
  const found: string[] = [];
  for (const pattern of spec.knownPaths?.[deps.platform] ?? [])
    found.push(...(await expandKnownPath(pattern, deps)));
  return found;
};

const onWsl = async (deps: DiscoveryDeps): Promise<boolean> =>
  deps.platform === 'linux' && WSL_MARKER.test((await deps.readText(PROC_VERSION)) ?? '');

const firstExecutable = async (
  candidates: string[],
  deps: DiscoveryDeps,
): Promise<string | undefined> => {
  for (const candidate of candidates) if (await deps.isExecutable(candidate)) return candidate;
  return undefined;
};

/** A version we could not read is not a missing engine: the binary exists and runs. */
const probeVersion = async (
  spec: EngineSpec,
  path: string,
  deps: DiscoveryDeps,
): Promise<{ version?: string; error?: EngineInfo['error'] }> => {
  if (spec.versionArgs === undefined || spec.versionPattern === undefined) return {};
  // On Windows `soffice.exe` opens its own console for --version and waits for Enter, so nothing reaches us;
  // the console twin `soffice.com` next to it prints to a pipe. Engines without a twin fall through to the .exe.
  const probes =
    deps.platform === 'win32' && /\.exe$/i.test(path)
      ? [path.replace(/\.exe$/i, '.com'), path]
      : [path];
  for (const probe of probes) {
    try {
      const output = await deps.exec(probe, spec.versionArgs, PROBE_TIMEOUT_MS);
      const version = new RegExp(spec.versionPattern).exec(output)?.[1];
      if (version !== undefined) return { version };
    } catch {
      // Try the next probe, then report the same result as an unreadable version.
    }
  }
  return { error: { code: 'version-check-failed', params: {} } };
};

export interface DiscoverInput {
  spec: EngineSpec;
  deps?: DiscoveryDeps;
  override?: string; // Settings.engines.paths[spec.id]
}

export const discover = async ({
  spec,
  deps = realDeps,
  override,
}: DiscoverInput): Promise<EngineInfo> => {
  const info = basicInfo(spec, deps.platform);

  if (spec.bundled === true) {
    const version = deps.bundledVersion(spec.id);
    return {
      ...info,
      found: true,
      source: 'bundled',
      ...(version === undefined ? {} : { version }),
    };
  }

  let path: string | undefined;
  let source: NonNullable<EngineInfo['source']>;
  if (override !== undefined && override !== '') {
    // No fall-through: a wrong path must show as wrong, not be hidden by another install.
    if (!(await deps.isExecutable(override)))
      return { ...info, error: { code: 'override-not-executable', params: { path: override } } };
    path = override;
    source = 'override';
  } else {
    // A Windows .exe under /mnt/c can't read the Linux-style paths we'd give it.
    const skip = (await onWsl(deps)) ? WINDOWS_DRIVE_MOUNT : undefined;
    const allowed = (candidates: string[]): string[] =>
      candidates.filter((candidate) => skip === undefined || !skip.test(candidate));
    path = await firstExecutable(allowed(pathCandidates(spec, deps)), deps);
    source = 'path';
    if (path === undefined) {
      path = await firstExecutable(allowed(await knownCandidates(spec, deps)), deps);
      source = 'known-dir';
    }
  }
  if (path === undefined) return info;

  return { ...info, found: true, path, source, ...(await probeVersion(spec, path, deps)) };
};

export interface DiscoverAllInput {
  specs: readonly EngineSpec[];
  overrides: Readonly<Record<string, string>>; // Settings.engines.paths
  deps?: DiscoveryDeps;
}

export const discoverAll = ({
  specs,
  overrides,
  deps = realDeps,
}: DiscoverAllInput): Promise<EngineInfo[]> =>
  Promise.all(specs.map((spec) => discover({ spec, deps, override: overrides[spec.id] })));
