import { join } from 'node:path';
import type { CoreStatus, Job, RpcEvent } from '@filecon/core/types';
import { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess } from 'electron';
import { createTranslator } from '../shared/i18n.ts';
import { CoreCallError } from './coreClient.ts';
import { createHandlers } from './ipc.ts';
import { createLogger } from './log.ts';
import { loadSettings } from './settings.ts';
import { createSupervisor, type CoreProcess } from './supervisor.ts';
import { lockNavigation, webPreferences } from './window.ts';

app.setName('fileCon'); // before userData is read, so dev and packaged runs share one folder

const WINDOW_SIZE = { width: 1100, height: 760 };

// RPC events that reach the renderer as push channels (CONTRACTS section 7).
const PUSH_FOR_EVENT: Partial<Record<RpcEvent, string>> = {
  'job.update': 'job:update',
  'engines.changed': 'engines:changed',
  'engine.install.progress': 'engines:installProgress',
};

const toCoreProcess = (child: Electron.UtilityProcess): CoreProcess => ({
  postMessage: (message) => child.postMessage(message),
  onMessage: (listener) => child.on('message', listener),
  onExit: (listener) => child.on('exit', listener),
  onOutput: (listener) => {
    for (const stream of [child.stdout, child.stderr])
      stream?.on('data', (chunk: Buffer) => listener(chunk.toString()));
  },
  kill: () => {
    child.kill();
  },
});

const start = async (): Promise<void> => {
  const userData = app.getPath('userData');
  const logger = await createLogger({ dir: join(userData, 'logs') });
  const settings = await loadSettings({
    dir: userData,
    warn: (message) => logger.log('warn', message),
  });
  const translate = createTranslator({
    locale: 'en', // shortcut: main text is English until a second catalog exists, M1.1 language setting
    warn: (message) => logger.log('warn', message),
  });

  let window: BrowserWindow | undefined;
  let lastStatus: { status: CoreStatus; restarts: number } = { status: 'starting', restarts: 0 };
  const knownOutputs = new Set<string>();
  const send = (channel: string, data: unknown): void => {
    window?.webContents.send(channel, data);
  };

  const supervisor = createSupervisor({
    fork: () =>
      toCoreProcess(
        utilityProcess.fork(join(import.meta.dirname, 'coreHost.js'), [], {
          stdio: 'pipe',
          serviceName: 'fileCon core',
        }),
      ),
    settings: () => settings.current(),
    dataDir: userData,
    onStatus: (update) => {
      lastStatus = update;
      logger.log('info', `core status: ${update.status} (restarts ${update.restarts})`);
      send('core:status', update);
    },
    onEvent: (name, data) => {
      if (name === 'job.update')
        for (const output of (data as Job).outputs) knownOutputs.add(output);
      const channel = PUSH_FOR_EVENT[name];
      if (channel !== undefined) send(channel, data);
    },
    log: (level, message) => logger.log(level, message),
    now: Date.now,
  });

  const handlers = createHandlers({
    call: (method, params) => supervisor.call(method, params),
    settings,
    translate,
    dialogs: {
      openFiles: async () =>
        (await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })).filePaths,
      chooseDir: async () =>
        (await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }))
          .filePaths[0] ?? null,
      chooseEngine: async () =>
        (await dialog.showOpenDialog({ properties: ['openFile'] })).filePaths[0] ?? null,
      confirm: async ({ message, accept, decline }) =>
        (await dialog.showMessageBox({ message, buttons: [accept, decline], cancelId: 1 }))
          .response === 0,
    },
    shell: {
      reveal: (path) => shell.showItemInFolder(path),
      openExternal: (url) => shell.openExternal(url),
    },
    isKnownOutput: (path) => knownOutputs.has(path),
    log: (level, message) => logger.log(level, message),
  });
  for (const [channel, handler] of Object.entries(handlers)) {
    // A rejected invoke loses everything but the message, so the reply carries the CoreError itself.
    ipcMain.handle(channel, async (_event, payload: unknown) => {
      try {
        return { ok: true, value: await handler(payload) };
      } catch (caught) {
        if (caught instanceof CoreCallError) return { ok: false, error: caught.error };
        logger.log('error', `${channel} failed: ${String(caught)}`);
        return { ok: false, error: { code: 'INVALID_REQUEST', params: {} } };
      }
    });
  }

  const createWindow = (): void => {
    window = new BrowserWindow({
      ...WINDOW_SIZE,
      webPreferences: webPreferences(join(import.meta.dirname, '../preload/index.js')),
    });
    lockNavigation(window.webContents);
    window.webContents.on('did-finish-load', () => send('core:status', lastStatus));
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl === undefined)
      void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
    else void window.loadURL(devUrl);
  };

  app.on('second-instance', () => {
    if (window?.isMinimized() === true) window.restore();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());

  // F13: ask core to clean up first, then really quit.
  let shutDown = false;
  app.on('before-quit', (event) => {
    if (shutDown) return;
    event.preventDefault();
    shutDown = true;
    void supervisor
      .shutdown()
      .then(() => logger.flush())
      .finally(() => app.quit());
  });

  supervisor.start();
  createWindow();
};

if (!app.requestSingleInstanceLock()) app.quit();
else
  app
    .whenReady()
    .then(start)
    .catch((caught: unknown) => {
      // The logger may be what failed, so stderr is the only place left to say so.
      console.error('fileCon failed to start', caught);
      app.exit(1);
    });
