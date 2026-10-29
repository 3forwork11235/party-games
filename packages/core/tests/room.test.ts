import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPartyClient } from '../src/client/index.js';
import type { ConnectionStatus } from '../src/client/index.js';
import { TestRoom, opts, st, waitFor } from './helpers.js';

let server: ColyseusTestServer;

beforeAll(async () => {
  server = await boot({
    initializeGameServer: (gs) => {
      gs.define('test', TestRoom);
    },
  });
});
afterAll(async () => {
  await server.shutdown();
});
afterEach(async () => {
  await server.cleanup();
});

const create = (id: string): Promise<Room<unknown>> => server.sdk.create('test', opts(id));
const join = (code: string, id: string): Promise<Room<unknown>> =>
  server.sdk.joinById(code, opts(id));
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('PartyRoom', () => {
  it('создаёт комнату с кодом из 5 символов; создатель — хост', async () => {
    const a = await create('p1');
    expect(a.roomId).toMatch(/^[A-HJKMN-Z2-9]{5}$/);
    await waitFor(() => st(a).hostId === 'p1');
    expect(st(a).code).toBe(a.roomId);
    expect(st(a).phase).toBe('lobby');
  });

  it('вход по коду; хост остаётся прежним', async () => {
    const a = await create('p1');
    const b = await join(a.roomId, 'p2');
    await waitFor(() => st(b).players.size === 2);
    expect(st(b).hostId).toBe('p1');
  });

  it('старт только хостом и при ≥ minPlayers', async () => {
    const a = await create('p1');
    a.send('core:start', {});
    await pause(100);
    expect(st(a).phase).toBe('lobby');
    const b = await join(a.roomId, 'p2');
    await waitFor(() => st(b).players.size === 2);
    b.send('core:start', {});
    await pause(100);
    expect(st(a).phase).toBe('lobby');
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'countdown');
  });

  it('полный цикл до results и возврат в лобби', async () => {
    const a = await create('p1');
    const b = await join(a.roomId, 'p2');
    await waitFor(() => st(b).players.size === 2);
    a.send('core:start', {});
    const seen = new Set<string>();
    await waitFor(() => {
      seen.add(st(a).phase);
      if (st(a).phase === 'adBreak') {
        a.send('core:adDone', {});
        b.send('core:adDone', {});
      }
      return st(a).phase === 'results';
    }, 6000);
    expect([...seen]).toEqual(expect.arrayContaining(['countdown', 'round', 'roundEnd', 'adBreak']));
    expect(st(a).players.get('p1')?.score).toBe(20);
    a.send('core:restart', {});
    await waitFor(() => st(a).phase === 'lobby');
  });

  it('очки сохраняются при переподключении с тем же playerId', async () => {
    const a = await create('p1');
    await join(a.roomId, 'p2');
    const c = await join(a.roomId, 'p3');
    await waitFor(() => st(c).players.size === 3);
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'roundEnd');
    const token = c.reconnectionToken;
    c.connection.close();
    await waitFor(() => st(a).players.get('p3')?.connected === false);
    expect(st(a).players.get('p3')?.score).toBe(10);
    await server.sdk.reconnect(token);
    await waitFor(() => st(a).players.get('p3')?.connected === true);
    expect(st(a).players.get('p3')?.score).toBe(10);
    // повторный join с тем же playerId в идущей игре: перепривязка, а не ошибка
    const c3 = await join(a.roomId, 'p3');
    await waitFor(() => st(c3).players.get('p3')?.score === 10);
    expect(st(a).players.size).toBe(3);
  });

  it('передача хоста при выходе в лобби', async () => {
    const a = await create('p1');
    const b = await join(a.roomId, 'p2');
    await waitFor(() => st(b).players.size === 2);
    await a.leave(true);
    await waitFor(() => st(b).hostId === 'p2');
    expect(st(b).players.size).toBe(1);
  });

  it('флуд → core:kicked flood', async () => {
    const a = await create('p1');
    await join(a.roomId, 'p2');
    let reason = '';
    a.onMessage('core:kicked', (m: { reason: string }) => (reason = m.reason));
    for (let i = 0; i < 400; i++) a.send('core:ready', { ready: i % 2 === 0 });
    await waitFor(() => reason === 'flood');
  });

  it('новый игрок в идущую игру → started; в полную комнату → ошибка', async () => {
    const a = await create('p1');
    await join(a.roomId, 'p2');
    await join(a.roomId, 'p3');
    await expect(join(a.roomId, 'p4')).rejects.toMatchObject({ code: 4004, message: 'full' });
    a.send('core:start', {});
    await waitFor(() => st(a).phase !== 'lobby');
    await a.leave(true);
    await expect(join(a.roomId, 'p5')).rejects.toMatchObject({ code: 4003, message: 'started' });
  });
});

describe('PartyClient', () => {
  const mem = () => {
    const data = new Map<string, unknown>();
    return {
      data,
      save: async (k: string, v: unknown) => void data.set(k, v),
      load: async <T>(k: string) => (data.get(k) as T | undefined) ?? null,
    };
  };
  const make = (storage = mem()) => ({
    storage,
    client: createPartyClient({ serverUrl: 'ws://127.0.0.1:2568', roomName: 'test', storage }),
  });

  it('create/join, состояние, rejoin и маппинг ошибок', async () => {
    const h1 = make();
    const code = await h1.client.create(opts('c1'));
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect(h1.client.status).toBe('connected');
    expect(h1.storage.data.has('party:rt:test')).toBe(true);

    const h2 = make();
    let phase = '';
    h2.client.onState((s) => (phase = s.phase));
    await h2.client.join(code.toLowerCase(), opts('c2'));
    await waitFor(() => phase === 'lobby');
    expect(Math.abs(h2.client.serverNow() - Date.now())).toBeLessThan(1000);

    await expect(make().client.join('ZZZZZ', opts('c3'))).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(make().client.join('bad', opts('c3'))).rejects.toMatchObject({
      code: 'not_found',
    });

    h1.client.send('core:start', {});
    await waitFor(() => phase === 'countdown');
    await expect(make().client.join(code, opts('c4'))).rejects.toMatchObject({ code: 'started' });

    const h2b = make(h2.storage);
    expect(await h2b.client.rejoin()).toBe(true);
    expect(h2b.client.code).toBe(code);
    expect(await make().client.rejoin()).toBe(false);

    const statuses: ConnectionStatus[] = [];
    h1.client.onStatus((s) => statuses.push(s));
    await h1.client.leave();
    expect(statuses).toContain('closed');
  });
});
