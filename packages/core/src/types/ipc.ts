export type CoreStatus = 'starting' | 'ready' | 'restarting' | 'unavailable';

// `window.filecon` method → the invoke channel behind it (null: answered in preload).
export const IPC_METHODS = {
  detect: 'core:detect',
  targets: 'core:targets',
  submit: 'job:submit',
  cancel: 'job:cancel',
  cancelAll: 'job:cancelAll',
  engines: 'engines:list',
  refreshEngines: 'engines:refresh',
  installEngine: 'engines:install',
  openFiles: 'dialog:openFiles',
  chooseDir: 'dialog:chooseDir',
  chooseEngine: 'dialog:chooseEngine',
  expand: 'files:expand',
  reveal: 'shell:reveal',
  openExternal: 'shell:openExternal',
  coreStatus: 'core:getStatus',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  on: null,
  pathForFile: null,
} as const;

export const PUSH_CHANNELS = [
  'job:update',
  'engines:changed',
  'engines:installProgress',
  'core:status',
] as const;
