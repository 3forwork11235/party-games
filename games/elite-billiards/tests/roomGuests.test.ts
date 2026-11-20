import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { EliteBilliardsRoom } from '../server/EliteBilliardsRoom.js';
import {
  BALL_SPECS,
  MSG_ADD_GUEST,
  MSG_SHOT,
  gameConfig,
  type BallKind,
  type RackBall,
} from '../shared/index.js';

const ball = (id: number, kind: BallKind, x: number, y: number): RackBall => ({
  id,
  kind,
  x,
  y,
  r: BALL_SPECS[kind].r,
  value: BALL_SPECS[kind].value,
});

/** Шар по диагонали на угловую лузу и один далёкий. */
const RACK = [ball(0, 'cue', 0.4, 0.4), ball(1, 'std', 0.2, 0.2), ball(2, 'small', 2.0, 0.6)];

class TestRoom extends EliteBilliardsRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 4000,
    roundEndMs: 2000,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
  protected createRackBalls(): RackBall[] {
    return RACK.map((b) => ({ ...b }));
  }
  protected rollMs(): number {
    return 80;
  }
  protected rateLimit = { ...DEFAULT_RATE_LIMIT, capacity: 1000, refillPerSec: 1000 };
  protected botThinkMs = [30, 80] as const;
  protected botAimLeadMs = 20;
}

interface View {
  phase: string;
  stage: string;
  shooterId: string;
  shotNo: number;
  guests: Map<string, string>;
  rackScore: Map<string, number>;
  players: Map<string, { nick: string; avatar: string }>;
  balls: Array<{ id: number; x: number; y: number; potted: boolean; pottedBy: string }>;
}

const st = (r: Room<unknown>): View => r.state as unknown as View;
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const opts = (id: string): object => ({ playerId: id, nick: id, avatar: '\u{1F436}', lang: 'ru' });
const GUEST = { nick: 'Vasya', avatar: '\u{1F431}' };

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
  server = await boot({ initializeGameServer: (gs) => gs.define('guests', TestRoom) }, 2593);
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

const guestId = (a: Room<unknown>): string => [...st(a).guests.keys()][0] as string;

async function lobbyWithGuest(): Promise<Room<unknown>> {
  const a = await server.sdk.create('guests', opts('A'));
  await waitFor(() => st(a).players.size === 1);
  a.send(MSG_ADD_GUEST, GUEST);
  await waitFor(() => st(a).guests.size === 1);
  return a;
}

async function startedWithGuest(): Promise<Room<unknown>> {
  const a = await lobbyWithGuest();
  a.send('core:start', {});
  await waitFor(() => st(a).phase === 'round' && st(a).stage === 'aim');
  return a;
}

/** A бьёт слабо (фол), ход переходит гостю. */
async function passToGuest(a: Room<unknown>): Promise<void> {
  a.send(MSG_SHOT, { dx: -1, dy: -1, power: 0, spinX: 0, spinY: 0 });
  await waitFor(() => st(a).shooterId === guestId(a) && st(a).stage === 'aim');
}

describe('EliteBilliardsRoom: гости (hot-seat)', () => {
  it('гость добавляется в лобби с ником и аватаром, игра стартует с одним клиентом', async () => {
    const a = await lobbyWithGuest();
    const id = guestId(a);
    expect(st(a).guests.get(id)).toBe('A');
    expect(st(a).players.get(id)?.nick).toBe('Vasya');
    expect(st(a).players.get(id)?.avatar).toBe('\u{1F431}');
    a.send(MSG_ADD_GUEST, GUEST);
    await waitFor(() => st(a).guests.size === 2);
    const nicks = [...st(a).guests.keys()].map((g) => st(a).players.get(g)?.nick);
    expect(new Set(nicks).size).toBe(2);
  });

  it('клиент бьёт за гостя в его ход, очки начисляются гостю', async () => {
    const a = await startedWithGuest();
    expect(st(a).shooterId).toBe('A');
    await passToGuest(a);
    const g = guestId(a);
    const cue = st(a).balls.find((b) => b.id === 0);
    const target = st(a).balls.find((b) => b.id === 1);
    if (!cue || !target) throw new Error('no balls');
    const dx = target.x - cue.x;
    const dy = target.y - cue.y;
    a.send(MSG_SHOT, { dx, dy, power: 0.25, spinX: 0, spinY: 0 });
    await waitFor(() => st(a).balls.find((b) => b.id === 1)?.potted === true, 4000);
    expect(st(a).balls.find((b) => b.id === 1)?.pottedBy).toBe(g);
    await waitFor(() => (st(a).rackScore.get(g) ?? 0) > 0);
  });

  it('другой игрок не управляет гостем соседа', async () => {
    const a = await lobbyWithGuest();
    const b = await server.sdk.joinById(a.roomId, opts('B'));
    await waitFor(() => st(a).players.size === 3);
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'round' && st(a).stage === 'aim');
    await passToGuest(a);
    const before = st(a).shotNo;
    b.send(MSG_SHOT, { dx: 1, dy: 0, power: 0, spinX: 0, spinY: 0 });
    await pause(200);
    expect(st(a).shotNo).toBe(before);
    expect(st(a).shooterId).toBe(guestId(a));
  });

  it('гость сам не бьёт (нет ИИ)', async () => {
    const a = await startedWithGuest();
    await passToGuest(a);
    const before = st(a).shotNo;
    await pause(500);
    expect(st(a).shotNo).toBe(before);
    expect(st(a).stage).toBe('aim');
  });

  it('добавление гостя вне лобби игнорируется', async () => {
    const a = await startedWithGuest();
    a.send(MSG_ADD_GUEST, GUEST);
    await pause(150);
    expect(st(a).guests.size).toBe(1);
    expect(st(a).players.size).toBe(2);
  });

  it('хост кикает гостя: исчезает и игрок, и запись', async () => {
    const a = await lobbyWithGuest();
    a.send('core:kick', { playerId: guestId(a) });
    await waitFor(() => st(a).guests.size === 0 && st(a).players.size === 1);
  });

  it('владелец уходит из лобби: его гости удаляются', async () => {
    const a = await server.sdk.create('guests', opts('A'));
    const b = await server.sdk.joinById(a.roomId, opts('B'));
    await waitFor(() => st(a).players.size === 2);
    b.send(MSG_ADD_GUEST, GUEST);
    await waitFor(() => st(a).guests.size === 1 && st(a).players.size === 3);
    await b.leave(true);
    await waitFor(() => st(a).guests.size === 0 && st(a).players.size === 1);
  });
});
