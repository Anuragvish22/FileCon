import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EngineInfo, Settings } from '@filecon/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreCallError } from '../../src/main/coreClient.ts';
import { createHandlers, type IpcDeps } from '../../src/main/ipc.ts';
import { DEFAULT_SETTINGS } from '../../src/main/settings.ts';
import { createTranslator } from '../../src/shared/i18n.ts';

let dir = '';
let file = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filecon-ipc-'));
  file = join(dir, 'in.png');
  await writeFile(file, 'x');
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const ENGINE: EngineInfo = {
  id: 'ffmpeg',
  pack: 'media',
  found: false,
  installUrl: 'https://example.test/guide',
  install: {
    kind: 'download',
    version: '1',
    url: 'https://downloads.example.test/ffmpeg.zip',
    sha256: 'abc',
    sizeBytes: 80_000_000,
    archive: 'zip',
    binDir: 'bin',
  },
};

const setup = (overrides: Partial<IpcDeps> = {}) => {
  const call = vi.fn<IpcDeps['call']>(() => Promise.resolve(undefined));
  const save = vi.fn<(settings: Settings) => Promise<void>>(() => Promise.resolve());
  const confirm = vi.fn<IpcDeps['dialogs']['confirm']>(() => Promise.resolve(true));
  const reveal = vi.fn<(path: string) => void>();
  const openExternal = vi.fn<(url: string) => Promise<void>>(() => Promise.resolve());
  const deps: IpcDeps = {
    call,
    settings: { current: () => DEFAULT_SETTINGS, save },
    coreStatus: () => ({ status: 'ready', restarts: 0 }),
    translate: createTranslator({ locale: 'en', warn: () => undefined }),
    dialogs: {
      openFiles: () => Promise.resolve([]),
      chooseDir: () => Promise.resolve(null),
      chooseEngine: () => Promise.resolve(null),
      confirm,
    },
    shell: { reveal, openExternal },
    isKnownOutput: (path) => path === '/out/known.png',
    log: () => undefined,
    ...overrides,
  };
  return { handlers: createHandlers(deps), call, save, confirm, reveal, openExternal };
};

const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (caught) {
    return caught instanceof CoreCallError ? caught.error.code : caught;
  }
  return 'resolved';
};

describe('core:getStatus', () => {
  it('answers the latest status, for a renderer that missed the push', async () => {
    const { handlers } = setup();
    await expect(handlers['core:getStatus']?.(undefined)).resolves.toEqual({
      status: 'ready',
      restarts: 0,
    });
  });
});

describe('core:detect', () => {
  it('relays valid paths resolved, and answers a bad path alone without calling core for it', async () => {
    const { handlers, call } = setup();
    call.mockResolvedValue([{ path: file, size: 1 }]);
    const results = (await handlers['core:detect']?.([file, '/missing/x.png'])) as {
      path: string;
      error?: { code: string };
    }[];
    expect(call).toHaveBeenCalledWith('detect', { paths: [file] });
    expect(results.map((result) => [result.path, result.error?.code])).toEqual([
      [file, undefined],
      ['/missing/x.png', 'INPUT_NOT_FOUND'],
    ]);
  });

  it('refuses a payload that is not a list', async () => {
    expect(await rejection(setup().handlers['core:detect']?.('x') ?? Promise.resolve())).toBe(
      'INVALID_REQUEST',
    );
  });
});

describe('job:submit', () => {
  it('sends the resolved input and outDir', async () => {
    const { handlers, call } = setup();
    await handlers['job:submit']?.([
      { kind: 'convert', input: file, target: 'jpg', options: {}, outDir: dir },
    ]);
    expect(call).toHaveBeenCalledWith('submit', {
      requests: [{ kind: 'convert', input: file, target: 'jpg', options: {}, outDir: dir }],
    });
  });

  it.each([
    ['a relative input', { kind: 'convert', input: 'a.png' }],
    ['an input with ..', { kind: 'convert', input: `${dir}/../x.png` }],
    ['an outDir that is a file', { kind: 'convert', input: file, outDir: file }],
    ['a merge input that is missing', { kind: 'merge', inputs: [file, '/nope.pdf'] }],
  ])('does not relay %s', async (_name, request) => {
    const { handlers, call } = setup();
    const failure = await rejection(handlers['job:submit']?.([request]) ?? Promise.resolve());
    expect(failure).toMatch(/^INPUT_/);
    expect(call).not.toHaveBeenCalled();
  });
});

describe('shell', () => {
  it('reveals only a path that a job produced', async () => {
    const { handlers, reveal } = setup();
    await handlers['shell:reveal']?.('/out/known.png');
    expect(reveal).toHaveBeenCalledWith('/out/known.png');
    expect(await rejection(handlers['shell:reveal']?.('/etc/passwd') ?? Promise.resolve())).toBe(
      'INVALID_REQUEST',
    );
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('opens only the install guide of an engine', async () => {
    const { handlers, call, openExternal } = setup();
    call.mockResolvedValue([ENGINE]);
    await handlers['shell:openExternal']?.(ENGINE.installUrl);
    expect(openExternal).toHaveBeenCalledWith(ENGINE.installUrl);
    expect(
      await rejection(handlers['shell:openExternal']?.('https://evil.test') ?? Promise.resolve()),
    ).toBe('INVALID_REQUEST');
    expect(openExternal).toHaveBeenCalledTimes(1);
  });
});

describe('engines:install', () => {
  it('asks first, naming engine, size and host, then relays', async () => {
    const { handlers, call, confirm } = setup();
    call.mockResolvedValueOnce([ENGINE]);
    await handlers['engines:install']?.('ffmpeg');
    expect(confirm).toHaveBeenCalledWith({
      message: 'Download ffmpeg (80 MB) from downloads.example.test?',
      accept: 'Download',
      decline: 'Cancel',
    });
    expect(call).toHaveBeenLastCalledWith('engines.install', { engineId: 'ffmpeg' });
  });

  it('rejects with CANCELLED and relays nothing when declined', async () => {
    const { handlers, call, confirm } = setup();
    call.mockResolvedValueOnce([ENGINE]);
    confirm.mockResolvedValue(false);
    expect(await rejection(handlers['engines:install']?.('ffmpeg') ?? Promise.resolve())).toBe(
      'CANCELLED',
    );
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe('settings:set', () => {
  it('validates, saves, then tells core', async () => {
    const { handlers, call, save } = setup();
    const merged = (await handlers['settings:set']?.({ concurrency: 3 })) as Settings;
    expect(merged.concurrency).toBe(3);
    expect(save).toHaveBeenCalledWith(merged);
    expect(call).toHaveBeenCalledWith('settings.apply', { settings: merged });
  });

  it('refuses an invalid patch without saving', async () => {
    const { handlers, save } = setup();
    expect(
      await rejection(handlers['settings:set']?.({ concurrency: 99 }) ?? Promise.resolve()),
    ).toBe('INVALID_REQUEST');
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the saved settings when core is down', async () => {
    const { handlers, call, save } = setup();
    call.mockRejectedValue(new CoreCallError({ code: 'CORE_UNAVAILABLE', params: {} }));
    await expect(handlers['settings:set']?.({ concurrency: 2 })).resolves.toBeDefined();
    expect(save).toHaveBeenCalled();
  });
});

describe('relays', () => {
  it('turns payloads into the RPC params core expects', async () => {
    const { handlers, call } = setup();
    await handlers['core:targets']?.(['png']);
    await handlers['job:cancel']?.('job-1');
    expect(call).toHaveBeenCalledWith('targets', { formats: ['png'] });
    expect(call).toHaveBeenCalledWith('cancel', { jobId: 'job-1' });
    expect(await rejection(handlers['job:cancel']?.(5) ?? Promise.resolve())).toBe(
      'INVALID_REQUEST',
    );
  });
});
