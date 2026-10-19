import type { FileconApi } from '../preload/api.ts';

declare global {
  interface Window {
    /** Exposed by the preload script, the renderer's only way out (CONTRACTS section 7). */
    filecon: FileconApi;
  }
}
