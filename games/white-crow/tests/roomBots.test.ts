import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { CrowRoom } from '../server/CrowRoom.js';
import { MSG_PICK, MSG_SETTINGS, gameConfig } from '../shared/index.js';

class BotRoom extends CrowRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 3000,
    roundEndMs: 100,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
  protected rateLimit = { ...DEFAULT_RATE_LIMIT, capacity: 1000, refillPerSec: 1000 };
  protected botDelayRange = [20, 80] as const;
}

interface View {
  phase: string;
  round: number;
  hostId: string;
  rounds: number;
  options: number[];
  picked: string[];
  players: Map<string, unknown>;
}
type R = Room<unknown>;
const st = (r: R): View => r.state as unknown as View;
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const opts = (id: string): object => ({ playerId: id, nick: id, avatar: '\u{1F436}', lang: 'ru' });

async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  for (;;) {
    let ok = false;
    try {
      ok = pred();
    } catch {
      /* состояние ещё не пришло */
    }
    if (ok) return;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await pause(10);
  }
}

let server: ColyseusTestServer;
beforeAll(async () => {
  server = await boot({ initializeGameServer: (gs) => gs.define('bots', BotRoom) }, 2576);
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

describe('CrowRoom: боты', () => {
  it('1 человек + 2 бота проходят 6 раундов до results, раунд кончается досрочно', async () => {
    const a = await server.sdk.create('bots', opts('A'));
    await waitFor(() => st(a).players.size === 1);
    a.send('core:addBot', {});
    a.send('core:addBot', {});
    await waitFor(() => st(a).players.size === 3);
    a.send(MSG_SETTINGS, { packIds: ['everyday'], rounds: 6 });
    await waitFor(() => st(a).rounds === 6);
    a.send('core:start', {});
    for (let round = 1; round <= 6; round++) {
      await waitFor(() => st(a).phase === 'round' && st(a).round === round);
      const t0 = Date.now();
      await waitFor(() => st(a).picked.length === 2);
      expect(st(a).picked.every((id) => id.startsWith('bot:'))).toBe(true);
      a.send(MSG_PICK, { option: st(a).options[0] });
      await waitFor(() => st(a).phase === 'roundEnd', 1500);
      expect(Date.now() - t0).toBeLessThan(2000);
      if (round < 6) {
        await waitFor(() => st(a).phase === 'adBreak');
        a.send('core:adDone', {});
      }
    }
    await waitFor(() => st(a).phase === 'results');
  }, 20000);

  it('ботов добавляет только хост', async () => {
    const a = await server.sdk.create('bots', opts('A'));
    const b = await server.sdk.joinById(a.roomId, opts('B'));
    await waitFor(() => st(a).players.size === 2);
    b.send('core:addBot', {});
    await pause(100);
    expect(st(a).players.size).toBe(2);
    a.send('core:addBot', {});
    await waitFor(() => st(a).players.size === 3);
  });
});
