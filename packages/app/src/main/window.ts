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
