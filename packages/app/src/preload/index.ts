import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { createApi } from './api.ts';

contextBridge.exposeInMainWorld(
  'filecon',
  createApi({
    invoke: (channel, payload) => ipcRenderer.invoke(channel, payload) as Promise<unknown>,
    subscribe: (channel, listener) => {
      const handler = (_event: unknown, data: unknown): void => listener(data);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
    pathForFile: (file) => webUtils.getPathForFile(file),
  }),
);
