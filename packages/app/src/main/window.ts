/** Hard rule 6, as a plain object so a test can read it without importing `electron`. */
export const webPreferences = (preload: string) =>
  ({
    preload,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  }) as const;

/** The parts of `webContents` that `lockNavigation` touches. */
export interface NavigationTarget {
  on(event: 'will-navigate', listener: (navigation: { preventDefault(): void }) => void): void;
  setWindowOpenHandler(handler: () => { action: 'deny' }): void;
}

/** The app is one page: nothing may navigate away from it or open another window. */
export const lockNavigation = (contents: NavigationTarget): void => {
  contents.on('will-navigate', (navigation) => {
    navigation.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
};

/** The parts of a `BrowserWindow` that `sendToWindow` touches. */
export interface PushTarget {
  isDestroyed(): boolean;
  webContents: { isDestroyed(): boolean; send(channel: string, data: unknown): void };
}

/** Core keeps pushing while the app quits; sending to a closed window throws "Object has been destroyed". */
export const sendToWindow = (
  window: PushTarget | undefined,
  channel: string,
  data: unknown,
): void => {
  if (window === undefined || window.isDestroyed() || window.webContents.isDestroyed()) return;
  window.webContents.send(channel, data);
};
