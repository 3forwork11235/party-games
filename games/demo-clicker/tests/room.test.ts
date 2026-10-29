import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { ClickerRoom } from '../server/ClickerRoom.js';
import { MSG_TAP, gameConfig } from '../shared/index.js';

class FastRoom extends ClickerRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 60,
    roundMs: 700,
    roundEndMs: 250,
    adBreakMinMs: 30,
    adBreakMaxMs: 500,
  };
  protected readonly tapWindowMs = 100;
  // тест шлёт нажатия быстрее живого клиента — расширяем общий core-бакет
  protected rateLimit = { ...DEFAULT_RATE_LIMIT, capacity: 1000, refillPerSec: 1000 };
}

class SlowRoundRoom extends FastRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 60,
    roundMs: 5000,
    roundEndMs: 250,
  };
}

interface View {
  phase: string;
  round: number;
  clicks: Map<string, number>;
  finishOrder: string[];
  players: Map<string, { score: number; roundScore: number }>;
}
const st = (r: Room<unknown>): View => r.state as View;
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

/** Шлёт n нажатий пачками по 20 (лимит окна 100 мс в FastRoom). */
async function tap(room: Room<unknown>, n: number): Promise<void> {
  for (let sent = 0; sent < n;) {
    const batch = Math.min(20, n - sent);
    for (let i = 0; i < batch; i++) room.send(MSG_TAP, {});
    sent += batch;
    if (sent < n) await pause(130);
  }
}

let server: ColyseusTestServer;
beforeAll(async () => {
  server = await boot(
    {
      initializeGameServer: (gs) => {
        gs.define('fast', FastRoom);
        gs.define('slow', SlowRoundRoom);
        gs.define('real', ClickerRoom);
      },
    },
    2569,
  );
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

async function start(name: string): Promise<[Room<unknown>, Room<unknown>]> {
  const a = await server.sdk.create(name, opts('A'));
  const b = await server.sdk.joinById(a.roomId, opts('B'));
  await waitFor(() => st(b).players.size === 2);
  a.send('core:start', {});
  return [a, b];
}

describe('ClickerRoom', () => {
  it('3 раунда до results с правильными очками', async () => {
    const [a, b] = await start('fast');
    const play = async (round: number, first: Room<unknown>, second: Room<unknown>, n2: number) => {
      await waitFor(() => st(a).phase === 'round' && st(a).round === round);
      await tap(first, 30);
      await tap(second, n2);
    };
    // раунд 1: A первый, B второй
    await play(1, a, b, 30);
    await waitFor(() => st(a).phase === 'roundEnd');
    expect([...st(a).finishOrder]).toEqual(['A', 'B']);
    expect(st(a).players.get('A')?.roundScore).toBe(3);
    expect(st(a).players.get('B')?.roundScore).toBe(2);
    // раунд 2: B первый, A второй
    await waitFor(() => st(a).phase === 'adBreak');
    a.send('core:adDone', {});
    b.send('core:adDone', {});
    await play(2, b, a, 30);
    await waitFor(() => st(a).phase === 'roundEnd' && st(a).round === 2);
    // раунд 3: A первый, B только 25 — конец по таймеру
    await waitFor(() => st(a).phase === 'adBreak');
    a.send('core:adDone', {});
    b.send('core:adDone', {});
    await play(3, a, b, 25);
    await waitFor(() => st(a).phase === 'roundEnd' && st(a).round === 3);
    expect([...st(a).finishOrder]).toEqual(['A']);
    expect(st(a).clicks.get('B')).toBe(25);
    await waitFor(() => st(a).phase === 'results');
    expect(st(a).players.get('A')?.score).toBe(3 + 2 + 3);
    expect(st(a).players.get('B')?.score).toBe(2 + 3 + 0);
  });

  it('раунд завершается досрочно, когда все дошли до 30', async () => {
    const [a, b] = await start('slow');
    await waitFor(() => st(a).phase === 'round');
    const t0 = Date.now();
    await tap(a, 30);
    await tap(b, 30);
    await waitFor(() => st(a).phase === 'roundEnd', 2000);
    expect(Date.now() - t0).toBeLessThan(2500); // roundMs = 5000
    expect([...st(a).finishOrder]).toEqual(['A', 'B']);
  });

  it('лимит 20 нажатий в секунду и игнор нажатий вне раунда', async () => {
    const [a, b] = await start('real');
    a.send(MSG_TAP, {}); // countdown — игнорируется
    await waitFor(() => st(a).phase === 'round', 6000);
    expect(st(a).clicks.get('A')).toBe(0);
    for (let i = 0; i < 25; i++) a.send(MSG_TAP, {});
    await waitFor(() => (st(b).clicks.get('A') ?? 0) >= 20);
    await pause(150);
    expect(st(b).clicks.get('A')).toBe(20);
  }, 10000);
});
