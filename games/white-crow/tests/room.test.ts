import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { CrowRoom } from '../server/CrowRoom.js';
import { MSG_HELLO, MSG_PEEK, MSG_PICK, MSG_SETTINGS, MSG_YOU, gameConfig } from '../shared/index.js';

class FastRoom extends CrowRoom {
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
  totalRounds: number;
  rounds: number;
  questionId: string;
  packs: string[];
  rules: string[];
  options: number[];
  picked: string[];
  peekers: string[];
  picks: Map<string, number>;
  lone: Map<string, number>;
  matches: Map<string, number>;
  players: Map<string, { score: number; roundScore: number }>;
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
  server = await boot(
    {
      initializeGameServer: (gs) => {
        gs.define('fast', FastRoom);
        gs.define('slow', SlowRoom);
      },
    },
    2574,
  );
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

async function join(name: string, n: number): Promise<R[]> {
  const first = await server.sdk.create(name, opts(NAMES[0] as string));
  const rooms = [first];
  for (let i = 1; i < n; i++) {
    rooms.push(await server.sdk.joinById(first.roomId, opts(NAMES[i] as string)));
  }
  await waitFor(() => st(first).players.size === n);
  return rooms;
}

const adDone = (rooms: R[]): void => rooms.forEach((r) => r.send('core:adDone', {}));

function listen<T>(r: R, type: string): T[] {
  const got: T[] = [];
  r.onMessage(type, (m: T) => got.push(m));
  return got;
}

async function startRound(a: R): Promise<void> {
  a.send('core:start', {});
  await waitFor(() => st(a).phase === 'round');
}

describe('CrowRoom', () => {
  it('полный цикл 3 игроков x 6 раундов, picks скрыты в round, финал x2', async () => {
    const rooms = await join('fast', 3);
    const [a, b, c] = rooms as [R, R, R];
    a.send(MSG_SETTINGS, { packIds: ['everyday'], rounds: 6 });
    await waitFor(() => st(a).rounds === 6);
    a.send('core:start', {});
    for (let round = 1; round <= 6; round++) {
      await waitFor(() => st(a).phase === 'round' && st(a).round === round);
      expect(st(a).totalRounds).toBe(6);
      expect(st(a).rules).toHaveLength(6);
      expect(st(a).questionId).toMatch(/^everyday\/\d+$/);
      expect(st(a).options).toHaveLength(4);
      const [o1, o2] = st(a).options as [number, number];
      a.send(MSG_PICK, { option: o1 });
      b.send(MSG_PICK, { option: o1 });
      await waitFor(() => st(a).picked.length === 2);
      expect(st(a).picks.size).toBe(0);
      c.send(MSG_PICK, { option: o2 });
      await waitFor(() => st(a).phase === 'roundEnd');
      expect(st(a).picks.size).toBe(3);
      expect(st(a).picks.get('C')).toBe(o2);
      const rule = st(a).rules[round - 1];
      const mult = round === 6 ? 2 : 1;
      const exp = { flock: [1, 1, 0], pair: [3, 3, 0], odd: [0, 0, 3] }[rule as string] as number[];
      expect(['A', 'B', 'C'].map((id) => st(a).players.get(id)?.roundScore)).toEqual(
        exp.map((x) => x * mult),
      );
      if (round < 6) {
        await waitFor(() => st(a).phase === 'adBreak');
        adDone(rooms);
      }
    }
    await waitFor(() => st(a).phase === 'results');
    expect(st(a).matches.get('A')).toBe(6);
    expect(st(a).lone.get('C')).toBe(6);
  }, 20000);

  it('раунд кончается досрочно, когда выбрали все подключённые', async () => {
    const [a, b, c] = (await join('slow', 3)) as [R, R, R];
    await startRound(a);
    const t0 = Date.now();
    const o = st(a).options[0] as number;
    a.send(MSG_PICK, { option: o });
    b.send(MSG_PICK, { option: o });
    await waitFor(() => st(a).picked.length === 2);
    await c.leave(true);
    await waitFor(() => st(a).phase === 'roundEnd', 1000);
    expect(Date.now() - t0).toBeLessThan(1200);
  });

  it('выбор вне options игнорируется, повторный перезаписывает', async () => {
    const [a, b] = (await join('slow', 3)) as [R, R, R];
    await startRound(a);
    const shown = [...st(a).options];
    const hidden = [0, 1, 2, 3, 4, 5].find((i) => !shown.includes(i)) as number;
    a.send(MSG_PICK, { option: hidden });
    a.send(MSG_PICK, { option: 1.5 });
    await pause(80);
    expect(st(a).picked.length).toBe(0);
    a.send(MSG_PICK, { option: shown[0] });
    await waitFor(() => st(a).picked.length === 1);
    a.send(MSG_PICK, { option: shown[1] });
    const you = listen<{ option: number }>(a, MSG_YOU);
    await pause(60);
    a.send(MSG_HELLO, {});
    await waitFor(() => you.length > 0);
    expect(you[0]?.option).toBe(shown[1]);
    expect(st(a).picked.length).toBe(1);
    void b;
  });

  it('peek: снимок, повтор -> peekUsed, остальным -> peek; hello', async () => {
    const [a, b, c] = (await join('slow', 3)) as [R, R, R];
    await startRound(a);
    const [o1, o2] = st(a).options as [number, number];
    a.send(MSG_PICK, { option: o1 });
    b.send(MSG_PICK, { option: o1 });
    await waitFor(() => st(a).picked.length === 2);
    const you = listen<{ round: number; option: number; peek: number[] }>(c, MSG_YOU);
    const toastsC = listen<{ key: string; params?: { name: string } }>(c, 'core:toast');
    const toastsA = listen<{ key: string }>(a, 'core:toast');
    c.send(MSG_PEEK, {});
    await waitFor(() => you.length === 1);
    expect(you[0]).toEqual({ round: 1, option: -1, peek: [2, 0, 0, 0] });
    await waitFor(() => st(a).peekers.length === 1);
    expect([...st(a).peekers]).toEqual(['C']);
    await waitFor(() => toastsA.some((t) => t.key === 'crow.toast.peek'));
    expect(toastsC.some((t) => t.key === 'crow.toast.peek')).toBe(false);
    c.send(MSG_PEEK, {});
    await waitFor(() => toastsC.some((t) => t.key === 'crow.toast.peekUsed'));
    expect([...st(a).peekers]).toEqual(['C']);
    c.send(MSG_PICK, { option: o2 });
    await waitFor(() => st(a).phase === 'roundEnd');
    c.send(MSG_HELLO, {});
    await waitFor(() => you.length === 2);
    expect(you[1]?.option).toBe(o2);
  });

  it('settings: только хост, валидация', async () => {
    const [a, b] = (await join('fast', 3)) as [R, R, R];
    expect([...st(a).packs]).toEqual(['everyday', 'fantasy']);
    b.send(MSG_SETTINGS, { packIds: ['food'], rounds: 12 });
    await pause(80);
    expect([...st(a).packs]).toEqual(['everyday', 'fantasy']);
    expect(st(a).rounds).toBe(9);
    a.send(MSG_SETTINGS, { packIds: ['food', 'world'], rounds: 12 });
    await waitFor(() => st(a).rounds === 12);
    expect([...st(a).packs]).toEqual(['food', 'world']);
    a.send(MSG_SETTINGS, { packIds: ['food', 'bogus'], rounds: 6 });
    a.send(MSG_SETTINGS, { packIds: ['food'], rounds: 7 });
    a.send(MSG_SETTINGS, { packIds: ['food', 'food'], rounds: 6 });
    await pause(80);
    expect([...st(a).packs]).toEqual(['food', 'world']);
    expect(st(a).rounds).toBe(12);
    a.send(MSG_SETTINGS, { packIds: [], rounds: 6 });
    await waitFor(() => st(a).rounds === 6);
    expect([...st(a).packs]).toEqual(['everyday', 'fantasy']);
  });

  it('totalRounds = выбранному числу', async () => {
    const [a] = (await join('slow', 3)) as [R, R, R];
    a.send(MSG_SETTINGS, { packIds: [], rounds: 12 });
    await waitFor(() => st(a).rounds === 12);
    await startRound(a);
    expect(st(a).totalRounds).toBe(12);
    expect(st(a).rules).toHaveLength(12);
  });

  it('8 игроков входят, 9-й получает full', async () => {
    const rooms = await join('fast', 8);
    await expect(server.sdk.joinById((rooms[0] as R).roomId, opts('K'))).rejects.toThrow();
  });
});
