import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { WhoOfUsRoom } from '../server/WhoOfUsRoom.js';
import { MSG_PACKS, MSG_SKIP, MSG_VOTE, gameConfig } from '../shared/index.js';

class FastRoom extends WhoOfUsRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 600,
    roundEndMs: 120,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
  protected rateLimit = { ...DEFAULT_RATE_LIMIT, capacity: 1000, refillPerSec: 1000 };
}

class SlowRoom extends FastRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 1500,
    roundEndMs: 300,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
}

interface View {
  phase: string;
  round: number;
  phaseEndsAt: number;
  questionId: string;
  packs: string[];
  voted: string[];
  tally: Map<string, number>;
  leaders: string[];
  correct: string[];
  skipsLeft: number;
  players: Map<string, { score: number; roundScore: number }>;
}
const st = (r: Room<unknown>): View => r.state as unknown as View;
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
  server = await boot(
    {
      initializeGameServer: (gs) => {
        gs.define('fast', FastRoom);
        gs.define('slow', SlowRoom);
      },
    },
    2570,
  );
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

async function join(name: string, n: number): Promise<Room<unknown>[]> {
  const first = await server.sdk.create(name, opts(NAMES[0] as string));
  const rooms = [first];
  for (let i = 1; i < n; i++) {
    rooms.push(await server.sdk.joinById(first.roomId, opts(NAMES[i] as string)));
  }
  await waitFor(() => st(first).players.size === n);
  return rooms;
}

const adDone = (rooms: Room<unknown>[]): void => rooms.forEach((r) => r.send('core:adDone', {}));

describe('WhoOfUsRoom', () => {
  it('полный цикл 3 игроков x 10 раундов, tally скрыт в round', async () => {
    const rooms = await join('fast', 3);
    const [a, b, c] = rooms as [Room<unknown>, Room<unknown>, Room<unknown>];
    a.send('core:start', {});
    for (let round = 1; round <= 10; round++) {
      await waitFor(() => st(a).phase === 'round' && st(a).round === round);
      expect(st(a).tally.size).toBe(0);
      expect(st(a).questionId).toMatch(/^(friends|family)\/\d+$/);
      a.send(MSG_VOTE, { target: 'B', guess: 'B' });
      b.send(MSG_VOTE, { target: 'B', guess: 'C' });
      await waitFor(() => st(a).voted.length === 2);
      expect(st(a).tally.size).toBe(0);
      c.send(MSG_VOTE, { target: 'A', guess: 'B' });
      await waitFor(() => st(a).phase === 'roundEnd');
      expect(st(a).tally.get('B')).toBe(2);
      expect([...st(a).leaders]).toEqual(['B']);
      expect([...st(a).correct].sort()).toEqual(['A', 'C']);
      if (round < 10) {
        await waitFor(() => st(a).phase === 'adBreak');
        adDone(rooms);
      }
    }
    await waitFor(() => st(a).phase === 'results');
    expect(st(a).players.get('A')?.score).toBe(20);
    expect(st(a).players.get('B')?.score).toBe(0);
    expect(st(a).players.get('C')?.score).toBe(20);
  }, 20000);

  it('раунд кончается досрочно, когда проголосовали все подключённые', async () => {
    const [a, b, c] = (await join('slow', 3)) as [Room<unknown>, Room<unknown>, Room<unknown>];
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'round');
    const t0 = Date.now();
    a.send(MSG_VOTE, { target: 'A', guess: 'A' });
    b.send(MSG_VOTE, { target: 'A', guess: 'A' });
    await waitFor(() => st(a).voted.length === 2);
    await c.leave(true);
    await waitFor(() => st(a).phase === 'roundEnd', 1000);
    expect(Date.now() - t0).toBeLessThan(1200);
  });

  it('skip: лимиты, сброс голосов, новый таймер', async () => {
    const [a, b, c] = (await join('slow', 3)) as [Room<unknown>, Room<unknown>, Room<unknown>];
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'round');
    const q1 = st(a).questionId;
    const ends1 = st(a).phaseEndsAt;
    a.send(MSG_VOTE, { target: 'B', guess: 'B' });
    await waitFor(() => st(a).voted.length === 1);
    await pause(60);
    a.send(MSG_SKIP, {});
    await waitFor(() => st(a).skipsLeft === 1);
    expect(st(a).questionId).not.toBe(q1);
    expect(st(a).voted.length).toBe(0);
    expect(st(a).phaseEndsAt).toBeGreaterThan(ends1);
    // повторный skip того же игрока игнорируется
    a.send(MSG_SKIP, {});
    await pause(80);
    expect(st(a).skipsLeft).toBe(1);
    b.send(MSG_SKIP, {});
    await waitFor(() => st(a).skipsLeft === 0);
    // лимит исчерпан
    c.send(MSG_SKIP, {});
    await pause(80);
    expect(st(a).skipsLeft).toBe(0);
    expect(st(a).phase).toBe('round');
  });

  it('packs: только хост, валидация, пусто -> по умолчанию', async () => {
    const [a, b] = (await join('fast', 3)) as [Room<unknown>, Room<unknown>, Room<unknown>];
    expect([...st(a).packs]).toEqual(['friends', 'family']);
    b.send(MSG_PACKS, { packIds: ['work'] });
    await pause(80);
    expect([...st(a).packs]).toEqual(['friends', 'family']);
    a.send(MSG_PACKS, { packIds: ['work', 'party', 'work'] });
    await waitFor(() => st(a).packs.includes('work'));
    expect([...st(a).packs]).toEqual(['work', 'party']);
    a.send(MSG_PACKS, { packIds: ['work', 'bogus'] });
    await pause(80);
    expect([...st(a).packs]).toEqual(['work', 'party']);
    a.send(MSG_PACKS, { packIds: [] });
    await waitFor(() => st(a).packs.includes('friends'));
    expect([...st(a).packs]).toEqual(['friends', 'family']);
  });

  it('10 игроков входят, 11-й получает full', async () => {
    const rooms = await join('fast', 10);
    await expect(server.sdk.joinById((rooms[0] as Room<unknown>).roomId, opts('K'))).rejects.toThrow();
  });
});
