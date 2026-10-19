import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHandlers, type IpcDeps } from '../../packages/app/src/main/ipc.ts';
import { createApi, PUSH_CHANNELS } from '../../packages/app/src/preload/api.ts';

const contracts = readFileSync(
  join(import.meta.dirname, '..', '..', 'docs', 'CONTRACTS.md'),
  'utf8',
);
const section = contracts.split(/^## 7\. /m)[1]?.split(/^## 8\. /m)[0] ?? '';

// Rows of the first table: | `name(args)` | `channel` | ... and the push channel table.
const rows = [...section.matchAll(/^\| `(\w+)\([^`]*\)` \| (`[^`]+`|—)/gm)];
const channels = rows.flatMap((row) =>
  row[2]?.startsWith('`') === true ? [row[2].slice(1, -1)] : [],
);
const methods = rows.map((row) => row[1]);
const pushChannels = [...section.matchAll(/^\| `((?:job|engines|core):\w+)` \| /gm)].map(
  (row) => row[1],
);

describe('CONTRACTS section 7 against the code', () => {
  it('has an ipc.ts handler for every channel, and no extra ones', () => {
    expect(channels.length).toBeGreaterThan(10);
    const handlers = createHandlers({} as IpcDeps);
    expect(Object.keys(handlers).sort()).toEqual([...channels].sort());
  });

  it('exposes every window.filecon method, plus on() and pathForFile()', () => {
    const api = createApi({
      invoke: () => Promise.resolve(undefined),
      subscribe: () => () => undefined,
      pathForFile: () => '',
    });
    expect(methods.length).toBeGreaterThan(10);
    expect(Object.keys(api).sort()).toEqual([...methods].sort());
  });

  it('lets the renderer subscribe to exactly the documented push channels', () => {
    expect(pushChannels.length).toBe(4);
    expect([...PUSH_CHANNELS].sort()).toEqual([...pushChannels].sort());
  });
});
