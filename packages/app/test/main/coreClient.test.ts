import type { RpcMessage } from '@filecon/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreCallError, createCoreClient } from '../../src/main/coreClient.ts';

const setup = () => {
  const sent: RpcMessage[] = [];
  const client = createCoreClient({ send: (message) => sent.push(message) });
  const ok = (id: number, result: unknown): RpcMessage => ({ kind: 'res', id, ok: true, result });
  return { client, sent, ok };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('core client', () => {
  it('matches a response to its call by id, with increasing ids', async () => {
    const { client, sent, ok } = setup();
    const first = client.call('detect', { paths: [] });
    const second = client.call('engines.list', {});
    expect(sent.map((message) => (message.kind === 'req' ? message.id : 0))).toEqual([1, 2]);
    client.receive(ok(1, 'first'));
    client.receive(ok(2, 'second'));
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
  });

  it('handles responses that arrive out of order', async () => {
    const { client, ok } = setup();
    const first = client.call('detect', {});
    const second = client.call('targets', {});
    client.receive(ok(2, 'second'));
    client.receive(ok(1, 'first'));
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
  });

  it('rejects with the core error', async () => {
    const { client } = setup();
    const call = client.call('plan', {});
    client.receive({
      kind: 'res',
      id: 1,
      ok: false,
      error: { code: 'NO_ROUTE', params: { from: 'a', to: 'b' } },
    });
    await expect(call).rejects.toMatchObject({ error: { code: 'NO_ROUTE' } });
  });

  it('times out an ordinary call after 30 s, and drops the late answer', async () => {
    const { client, ok } = setup();
    const call = client.call('detect', {});
    const caught = call.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await caught).toBeInstanceOf(CoreCallError);
    expect(await caught).toMatchObject({ error: { code: 'CORE_TIMEOUT' } });
    expect(() => client.receive(ok(1, 'late'))).not.toThrow();
  });

  it('never times out init, submit, cancel or shutdown', async () => {
    const { client, ok } = setup();
    const calls = (['init', 'submit', 'cancel', 'shutdown'] as const).map((method) =>
      client.call(method, {}),
    );
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    [1, 2, 3, 4].forEach((id) => client.receive(ok(id, id)));
    await expect(Promise.all(calls)).resolves.toEqual([1, 2, 3, 4]);
  });

  it('rejectAll fails every pending call with the given error', async () => {
    const { client } = setup();
    const calls = [client.call('detect', {}), client.call('submit', {})];
    client.rejectAll({ code: 'CORE_CRASHED', params: {} });
    for (const call of calls)
      await expect(call).rejects.toMatchObject({ error: { code: 'CORE_CRASHED' } });
  });

  it('passes events to listeners until unsubscribed, and ignores junk', () => {
    const { client } = setup();
    const seen: unknown[] = [];
    const unsubscribe = client.onEvent((name, data) => seen.push([name, data]));
    client.receive({ kind: 'evt', name: 'log', data: 1 });
    client.receive('junk');
    client.receive(null);
    unsubscribe();
    client.receive({ kind: 'evt', name: 'log', data: 2 });
    expect(seen).toEqual([['log', 1]]);
  });
});
