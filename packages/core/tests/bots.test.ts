import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CoreState } from '../src/server/index.js';
import { BOT_AVATAR, isBotId } from '../src/shared/index.js';
import type { GameConfig } from '../src/shared/contracts.js';
import { TestRoom, opts, st, waitFor } from './helpers.js';

class BotRoom extends TestRoom {
  protected readonly gameConfig: GameConfig = { ...new TestRoom().config, maxBots: 2 };
  protected createState(): CoreState {
    return new CoreState();
  }
}
class NoBotRoom extends TestRoom {}

let server: ColyseusTestServer;
beforeAll(async () => {
  server = await boot(
    {
      initializeGameServer: (gs) => {
        gs.define('bots', BotRoom);
        gs.define('nobots', NoBotRoom);
      },
    },
    2575,
  );
});
afterAll(async () => {
  await server.shutdown();
});
afterEach(async () => {
  await server.cleanup();
});

const create = (id: string, kind = 'bots'): Promise<Room<unknown>> =>
  server.sdk.create(kind, opts(id));
const join = (code: string, id: string): Promise<Room<unknown>> =>
  server.sdk.joinById(code, opts(id));
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const ids = (r: Room<unknown>): string[] => [...st(r).players.keys()];

describe('боты', () => {
  it('хост добавляет бота; игрок-бот помечен', async () => {
    const a = await create('p1');
    a.send('core:addBot', {});
    await waitFor(() => st(a).players.size === 2);
    const bot = st(a).players.get('bot:1') as unknown as { avatar: string; ready: boolean };
    expect(bot.avatar).toBe(BOT_AVATAR);
    expect(bot.ready).toBe(true);
    expect(ids(a).filter(isBotId)).toEqual(['bot:1']);
  });

  it('не хост не может добавить бота', async () => {
    const a = await create('p1');
    const b = await join(a.roomId, 'p2');
    await waitFor(() => st(b).players.size === 2);
    b.send('core:addBot', {});
    await pause(100);
    expect(st(a).players.size).toBe(2);
  });

  it('лимиты maxBots и maxPlayers', async () => {
    const a = await create('p1');
    for (let i = 0; i < 3; i++) a.send('core:addBot', {});
    await waitFor(() => st(a).players.size === 3);
    await pause(100);
    expect(st(a).players.size).toBe(3);
    const b = await create('q1');
    await join(b.roomId, 'q2');
    await join(b.roomId, 'q3').catch(() => null);
    b.send('core:addBot', {});
    await pause(100);
    expect(st(b).players.size).toBeLessThanOrEqual(3);
  });

  it('без maxBots addBot игнорируется', async () => {
    const a = await create('p1', 'nobots');
    a.send('core:addBot', {});
    await pause(100);
    expect(st(a).players.size).toBe(1);
  });

  it('1 человек + 1 бот стартуют; в игре addBot игнорируется', async () => {
    const a = await create('p1');
    a.send('core:addBot', {});
    await waitFor(() => st(a).players.size === 2);
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'round');
    a.send('core:addBot', {});
    await pause(100);
    expect(st(a).players.size).toBe(2);
  });

  it('хост кикает бота', async () => {
    const a = await create('p1');
    a.send('core:addBot', {});
    await waitFor(() => st(a).players.size === 2);
    a.send('core:kick', { playerId: 'bot:1' });
    await waitFor(() => st(a).players.size === 1);
  });

  it('новым хостом не становится бот', async () => {
    const a = await create('p1');
    const b = await join(a.roomId, 'p2');
    a.send('core:addBot', {});
    await waitFor(() => st(b).players.size === 3);
    await a.leave(true);
    await waitFor(() => st(b).hostId === 'p2');
    expect(isBotId(st(b).hostId)).toBe(false);
  });

  it('adBreak не ждёт ботов', async () => {
    const a = await create('p1');
    a.send('core:addBot', {});
    await waitFor(() => st(a).players.size === 2);
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'adBreak');
    a.send('core:adDone', {});
    await waitFor(() => st(a).phase === 'countdown', 1000);
  });

  it('вход с playerId bot:x отклоняется', async () => {
    const a = await create('p1');
    await expect(join(a.roomId, 'bot:x')).rejects.toThrow();
  });
});
