import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IPC_METHODS, PUSH_CHANNELS } from '../../packages/core/src/types/index.ts';
import { createHandlers, type IpcDeps } from '../../packages/app/src/main/ipc.ts';
import { createApi } from '../../packages/app/src/preload/api.ts';

const contracts = readFileSync(
  join(import.meta.dirname, '..', '..', 'docs', 'CONTRACTS.md'),
  'utf8',
);
const channels = Object.values(IPC_METHODS).filter((channel) => channel !== null);

describe('IPC_METHODS and PUSH_CHANNELS against the code and the docs', () => {
  it('has an ipc.ts handler for every channel, and no extra ones', () => {
    const handlers = createHandlers({} as IpcDeps);
    expect(Object.keys(handlers).sort()).toEqual([...channels].sort());
  });

  it('exposes every window.filecon method, plus on() and pathForFile()', () => {
    const api = createApi({
      invoke: () => Promise.resolve(undefined),
      subscribe: () => () => undefined,
      pathForFile: () => '',
    });
    expect(Object.keys(api).sort()).toEqual(Object.keys(IPC_METHODS).sort());
  });

  it('documents every method and channel in CONTRACTS section 7', () => {
    const section = contracts.split(/^## 7\. /m)[1]?.split(/^## 8\. /m)[0] ?? '';
    for (const name of [...Object.keys(IPC_METHODS), ...channels, ...PUSH_CHANNELS])
      expect(section, name).toContain(`\`${name}`);
  });
});
