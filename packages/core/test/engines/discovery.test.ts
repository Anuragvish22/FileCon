import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  discover,
  discoverAll,
  realDeps,
  type DiscoveryDeps,
} from '../../src/engines/discovery.ts';
import { ENGINE_SPECS } from '../../src/engines/specs.ts';
import type { EngineSpec } from '../../src/types/index.ts';

const LIBREOFFICE_OUTPUT = 'LibreOffice 24.8.3.2 480(Build:2)\n';
const WSL_VERSION = 'Linux version 5.15.167.4-microsoft-standard-WSL2';
const PROBE_TIMEOUT_MS = 5000;

const libreoffice = ENGINE_SPECS.find((spec) => spec.id === 'libreoffice') as EngineSpec;
const sharp = ENGINE_SPECS.find((spec) => spec.id === 'sharp') as EngineSpec;

interface FakeMachine {
  platform?: NodeJS.Platform;
  env?: Record<string, string>;
  executables?: string[]; // files we may run
  dirs?: Record<string, string[]>; // directory → entry names
  procVersion?: string;
  output?: string | Error; // what the version probe prints, or fails with
}

const machine = (fake: FakeMachine = {}) => {
  const execCalls: { path: string; args: readonly string[]; timeoutMs: number }[] = [];
  const deps: DiscoveryDeps = {
    platform: fake.platform ?? 'linux',
    env: fake.env ?? {},
    isExecutable: (path) => Promise.resolve((fake.executables ?? []).includes(path)),
    listDir: (dir) => Promise.resolve(fake.dirs?.[dir] ?? []),
    readText: (path) => Promise.resolve(path === '/proc/version' ? fake.procVersion : undefined),
    exec: (path, args, timeoutMs) => {
      execCalls.push({ path, args, timeoutMs });
      const output = fake.output ?? LIBREOFFICE_OUTPUT;
      return output instanceof Error ? Promise.reject(output) : Promise.resolve(output);
    },
    bundledVersion: (id) => (id === 'sharp' ? '0.34.1' : undefined),
  };
  return { deps, execCalls };
};

describe('discovery: happy path', () => {
  it('a bundled engine is found without looking anywhere', async () => {
    const { deps, execCalls } = machine();
    expect(await discover({ spec: sharp, deps })).toMatchObject({
      id: 'sharp',
      pack: 'builtin',
      found: true,
      source: 'bundled',
      version: '0.34.1',
    });
    expect(execCalls).toEqual([]);
  });

  it('a valid override is used first, with its version', async () => {
    const { deps } = machine({
      env: { PATH: '/usr/bin' },
      executables: ['/opt/mine/soffice', '/usr/bin/soffice'],
    });
    expect(
      await discover({ spec: libreoffice, deps, override: '/opt/mine/soffice' }),
    ).toMatchObject({
      found: true,
      path: '/opt/mine/soffice',
      source: 'override',
      version: '24.8.3.2',
    });
  });

  it('PATH is searched in order and the first hit wins', async () => {
    const { deps, execCalls } = machine({
      env: { PATH: '/first:/second' },
      executables: ['/second/soffice', '/first/soffice'],
    });
    const info = await discover({ spec: libreoffice, deps });
    expect(info).toMatchObject({ found: true, path: '/first/soffice', source: 'path' });
    expect(execCalls).toEqual([
      { path: '/first/soffice', args: ['--version'], timeoutMs: PROBE_TIMEOUT_MS },
    ]);
  });

  it('the version comes from the first capture of the pattern', async () => {
    const { deps } = machine({
      env: { PATH: '/bin' },
      executables: ['/bin/soffice'],
      output: 'warning: something\nLibreOffice 7.6.4.1 abcdef\n',
    });
    expect((await discover({ spec: libreoffice, deps })).version).toBe('7.6.4.1');
  });

  it('carries the install link, and the install method for this platform when there is one', async () => {
    const withInstall: EngineSpec = {
      ...libreoffice,
      install: {
        linux: { kind: 'command', commands: [{ label: 'apt', cmd: 'sudo apt install x' }] },
      },
    };
    const linux = await discover({ spec: withInstall, deps: machine().deps });
    expect(linux).toMatchObject({ found: false, installUrl: libreoffice.installUrl });
    expect(linux.install).toEqual(withInstall.install?.linux);
    expect(
      (await discover({ spec: withInstall, deps: machine({ platform: 'darwin' }).deps })).install,
    ).toBeUndefined();
  });
});

describe('discovery: must also pass', () => {
  it('an invalid override does not fall through to PATH', async () => {
    const { deps } = machine({ env: { PATH: '/usr/bin' }, executables: ['/usr/bin/soffice'] });
    const info = await discover({ spec: libreoffice, deps, override: '/typo/soffice' });
    expect(info.found).toBe(false);
    expect(info.error).toBeDefined();
    expect(info.path).toBeUndefined();
  });

  it('an override that is a directory is not found, with an error', async () => {
    // A directory is simply not an executable file for the fake and for the real check alike.
    const { deps } = machine({ executables: [] });
    const info = await discover({ spec: libreoffice, deps, override: '/opt/libreoffice/program' });
    expect(info).toMatchObject({ found: false });
    expect(info.error).toBeDefined();
  });

  it('on win32 PATHEXT lets soffice be found as soffice.EXE', async () => {
    const { deps } = machine({
      platform: 'win32',
      env: { Path: 'C:\\Tools;C:\\LO', PATHEXT: '.COM;.EXE' },
      executables: ['C:\\LO\\soffice.EXE'],
    });
    expect(await discover({ spec: libreoffice, deps })).toMatchObject({
      found: true,
      path: 'C:\\LO\\soffice.EXE',
      source: 'path',
    });
  });

  it('a known path with a glob finds the newest matching directory', async () => {
    const { deps } = machine({
      dirs: { '/opt': ['libreoffice7.6', 'libreoffice24.8', 'other'] },
      executables: ['/opt/libreoffice7.6/program/soffice', '/opt/libreoffice24.8/program/soffice'],
    });
    expect(await discover({ spec: libreoffice, deps })).toMatchObject({
      found: true,
      path: '/opt/libreoffice24.8/program/soffice',
      source: 'known-dir',
    });
  });

  it('a plain known path is used when PATH has nothing', async () => {
    const { deps } = machine({ executables: ['/snap/bin/soffice'] });
    expect(await discover({ spec: libreoffice, deps })).toMatchObject({
      path: '/snap/bin/soffice',
      source: 'known-dir',
    });
  });

  it('on WSL a binary under /mnt/c is skipped and the next one is used', async () => {
    const { deps } = machine({
      env: { PATH: '/mnt/c/Program Files/LibreOffice/program:/usr/bin' },
      executables: ['/mnt/c/Program Files/LibreOffice/program/soffice', '/usr/bin/soffice'],
      procVersion: WSL_VERSION,
    });
    expect((await discover({ spec: libreoffice, deps })).path).toBe('/usr/bin/soffice');
  });

  it('off WSL a /mnt/c path is a normal path', async () => {
    const { deps } = machine({
      env: { PATH: '/mnt/c/tools' },
      executables: ['/mnt/c/tools/soffice'],
      procVersion: 'Linux version 6.1.0-generic',
    });
    expect((await discover({ spec: libreoffice, deps })).path).toBe('/mnt/c/tools/soffice');
  });

  it("on WSL, an override under /mnt/c is the user's explicit choice and is kept", async () => {
    const { deps } = machine({
      executables: ['/mnt/c/LO/soffice.exe'],
      procVersion: WSL_VERSION,
    });
    expect(
      (await discover({ spec: libreoffice, deps, override: '/mnt/c/LO/soffice.exe' })).found,
    ).toBe(true);
  });

  it.each([
    ['the probe fails', new Error('timed out')],
    ['the output has no version', 'something else entirely'],
  ])('when %s the engine is still found, with an error and no version', async (_case, output) => {
    const { deps } = machine({ env: { PATH: '/bin' }, executables: ['/bin/soffice'], output });
    const info = await discover({ spec: libreoffice, deps });
    expect(info).toMatchObject({
      found: true,
      path: '/bin/soffice',
      error: 'version check failed',
    });
    expect(info.version).toBeUndefined();
  });

  it('a spec without a version command is found without probing', async () => {
    const plain: EngineSpec = { ...libreoffice, versionArgs: undefined, versionPattern: undefined };
    const { deps, execCalls } = machine({ env: { PATH: '/bin' }, executables: ['/bin/soffice'] });
    expect(await discover({ spec: plain, deps })).toMatchObject({
      found: true,
      path: '/bin/soffice',
    });
    expect(execCalls).toEqual([]);
  });

  it('nothing found gives found: false and no error', async () => {
    const info = await discover({ spec: libreoffice, deps: machine().deps });
    expect(info.found).toBe(false);
    expect(info.error).toBeUndefined();
  });

  it('discoverAll returns one result per spec, in spec order, applying each override', async () => {
    const { deps } = machine({ executables: ['/custom/soffice'] });
    const infos = await discoverAll({
      specs: ENGINE_SPECS,
      overrides: { libreoffice: '/custom/soffice' },
      deps,
    });
    expect(infos.map((info) => info.id)).toEqual(ENGINE_SPECS.map((spec) => spec.id));
    expect(infos.find((info) => info.id === 'libreoffice')?.source).toBe('override');
  });
});

describe('discovery: real dependencies', () => {
  let workDir: string;
  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'filecon-discovery-'));
  });
  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('isExecutable: a directory is not, a plain file is not, an executable file is', async () => {
    const folder = join(workDir, 'folder');
    await mkdir(folder);
    const plain = join(workDir, 'plain');
    await writeFile(plain, 'x');
    await chmod(plain, 0o644);
    const runnable = join(workDir, 'runnable');
    await writeFile(runnable, '#!/bin/sh\n');
    await chmod(runnable, 0o755);

    expect(await realDeps.isExecutable(folder)).toBe(false);
    expect(await realDeps.isExecutable(join(workDir, 'missing'))).toBe(false);
    expect(await realDeps.isExecutable(runnable)).toBe(true);
    if (process.platform !== 'win32') expect(await realDeps.isExecutable(plain)).toBe(false);
  });

  it('exec runs a real binary and returns its output', async () => {
    const output = await realDeps.exec(process.execPath, ['--version'], PROBE_TIMEOUT_MS);
    expect(output).toContain(process.version);
  });

  it('listDir lists a directory and gives [] for a missing one', async () => {
    await writeFile(join(workDir, 'listed.txt'), 'x');
    expect(await realDeps.listDir(workDir)).toContain('listed.txt');
    expect(await realDeps.listDir(join(workDir, 'nope'))).toEqual([]);
  });

  it('readText gives undefined for a missing file', async () => {
    expect(await realDeps.readText(join(workDir, 'nope'))).toBeUndefined();
  });
});
