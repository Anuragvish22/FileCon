import { MessageChannel } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { startHost, type HostPort } from '../src/host.ts';
import type { RpcMessage } from '../src/types/index.ts';

describe('startHost', () => {
  it('serves RPC over an Electron-shaped port and exits after the shutdown reply', async () => {
    const { port1: mainSide, port2: hostSide } = new MessageChannel();
    // Electron hands the listener an event whose payload is `data`; a worker_threads port hands it bare.
    const port: HostPort = {
      postMessage: (message) => hostSide.postMessage(message),
      on: (_event, listener) => hostSide.on('message', (data: unknown) => listener({ data })),
    };
    let exited = false;
    startHost({ port, exit: () => (exited = true) });

    const replies: RpcMessage[] = [];
    mainSide.on('message', (message: RpcMessage) => replies.push(message));
    mainSide.postMessage({ kind: 'req', id: 1, method: 'shutdown', params: {} });
    await new Promise((resume) => setTimeout(resume, 100));

    expect(replies).toEqual([{ kind: 'res', id: 1, ok: true, result: null }]);
    expect(exited).toBe(true);
    mainSide.close();
    hostSide.close();
  });
});
