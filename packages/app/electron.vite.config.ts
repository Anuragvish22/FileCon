import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // The core host is a second entry: utilityProcess forks out/main/coreHost.js.
        input: {
          index: resolve(import.meta.dirname, 'src/main/index.ts'),
          coreHost: resolve(import.meta.dirname, '../core/src/hostEntry.ts'),
        },
        external: ['sharp'],
      },
    },
  },
  preload: {
    // A sandboxed preload cannot be an ES module.
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } },
  },
  renderer: {
    plugins: [
      react(),
      {
        // The dev server injects CSS as inline <style> and talks to its socket, which the strict
        // `default-src 'self'` of index.html blocks. Only `pnpm dev` relaxes it, the built page keeps it.
        name: 'dev-csp',
        apply: 'serve',
        transformIndexHtml: (html) =>
          html.replace(
            "default-src 'self'",
            "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:",
          ),
      },
    ],
  },
});
