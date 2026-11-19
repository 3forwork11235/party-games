import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { EliteBilliardsRoom } from '../server/EliteBilliardsRoom.js';
import {
  BALL_SPECS,
  MSG_AIM,
  MSG_AIM_OF,
  MSG_SHOT,
  MSG_SHOT_PLAYED,
  gameConfig,
  type AimOfMessage,
  type BallKind,
  type RackBall,
  type ShotPlayedMessage,
} from '../shared/index.js';

const ball = (id: number, kind: BallKind, x: number, y: number): RackBall => ({
  id,
  kind,
  x,
  y,
  r: BALL_SPECS[kind].r,
  value: BALL_SPECS[kind].value,
});

const CUE = ball(0, 'cue', 0.5, 0.6);
/** Три шара далеко от битка: слабый удар в пустоту — фол noHit. */
const SCATTER = [CUE, ball(1, 'small', 2.0, 0.6), ball(2, 'std', 2.2, 0.3)];
/** Единственный шар по диагонали на угловую лузу (0,0). */
const POT = [ball(0, 'cue', 0.4, 0.4), ball(1, 'std', 0.2, 0.2)];
/** Биток летит в угловую лузу, второй шар остаётся. */
const SCRATCH = [ball(0, 'cue', 0.2, 0.2), ball(1, 'std', 2.0, 0.6)];

function makeRoom(rack: RackBall[], roundMs: number): typeof EliteBilliardsRoom {
  return class extends EliteBilliardsRoom {
    protected readonly gameConfig = {
      ...gameConfig,
      countdownMs: 40,
      roundMs,
      roundEndMs: 2000,
      adBreakMinMs: 20,
      adBreakMaxMs: 300,
    };
    protected createRackBalls(): RackBall[] {
      return rack.map((b) => ({ ...b }));
    }
    protected rollMs(): number {
      return 80;
    }
    protected rateLimit = { ...DEFAULT_RATE_LIMIT, capacity: 1000, refillPerSec: 1000 };
  };
}

interface View {
  phase: string;
  stage: string;
  shooterId: string;
  shotNo: number;
  cueInHand: boolean;
  lastFoul: string;
  lastPoints: number;
  order: string[];
  balls: Array<{ id: number; x: number; y: number; potted: boolean; pottedBy: string }>;
  rackScore: Map<string, number>;
  players: Map<string, { roundScore: number }>;
}

interface Bot {
  id: string;
  room: Room<unknown>;
  played: ShotPlayedMessage[];
  aims: AimOfMessage[];
}

const st = (b: Bot): View => b.room.state as unknown as View;
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const send = (b: Bot, type: string, payload: unknown = {}): void => b.room.send(type, payload);

async function waitFor(pred: () => boolean, timeoutMs = 3000): Promise<void> {
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

function track(id: string, room: Room<unknown>): Bot {
  const bot: Bot = { id, room, played: [], aims: [] };
  room.onMessage(MSG_SHOT_PLAYED, (m: ShotPlayedMessage) => bot.played.push(m));
  room.onMessage(MSG_AIM_OF, (m: AimOfMessage) => bot.aims.push(m));
  return bot;
}

const opts = (id: string): object => ({ playerId: id, nick: id, avatar: '\u{1F436}', lang: 'ru' });

async function startGame(server: ColyseusTestServer, name: string): Promise<[Bot, Bot]> {
  const ra = await server.sdk.create(name, opts('A'));
  const a = track('A', ra);
  const rb = await server.sdk.joinById(ra.roomId, opts('B'));
  const b = track('B', rb);
  await waitFor(() => st(a).players.size === 2);
  send(a, 'core:start');
  await waitFor(() => st(a).phase === 'round' && st(a).stage === 'aim');
  return [a, b];
}

let server: ColyseusTestServer;

beforeAll(async () => {
  server = await boot(
    {
      initializeGameServer: (gs) => {
        gs.define('scatter', makeRoom(SCATTER, 4000));
        gs.define('scatterFast', makeRoom(SCATTER, 250));
        gs.define('pot', makeRoom(POT, 4000));
        gs.define('scratch', makeRoom(SCRATCH, 4000));
      },
    },
    2591,
  );
});

afterAll(async () => {
  await server.shutdown();
});

describe('EliteBilliardsRoom', () => {
  it('starts with the first player aiming on a fresh rack', async () => {
    const [a] = await startGame(server, 'scatter');
    const s = st(a);
    expect(Array.from(s.order)).toEqual(['A', 'B']);
    expect(s.shooterId).toBe('A');
    expect(s.cueInHand).toBe(false);
    expect(s.balls.length).toBe(3);
    expect(s.rackScore.get('A')).toBe(0);
  });

  it('ignores a shot from a non-shooter', async () => {
    const [a, b] = await startGame(server, 'scatter');
    send(b, MSG_SHOT, { dx: 1, dy: 0, power: 0, spinX: 0, spinY: 0 });
    await pause(150);
    expect(st(a).stage).toBe('aim');
    expect(st(a).shotNo).toBe(0);
    expect(a.played.length).toBe(0);
  });

  it('rejects malformed shots', async () => {
    const [a] = await startGame(server, 'scatter');
    send(a, MSG_SHOT, { dx: 0, dy: 0, power: 0.5, spinX: 0, spinY: 0 });
    send(a, MSG_SHOT, { dx: 1, dy: 0, power: Number.NaN, spinX: 0, spinY: 0 });
    send(a, MSG_SHOT, 'nope');
    await pause(150);
    expect(st(a).shotNo).toBe(0);
  });

  it('shot: shotPlayed to everyone, then rolling -> aim with new positions and next shooter', async () => {
    const [a, b] = await startGame(server, 'scatter');
    send(a, MSG_SHOT, { dx: 0, dy: 3, power: 7, spinX: 0, spinY: 0 });
    await waitFor(() => a.played.length === 1 && b.played.length === 1);
    const m = b.played[0] as ShotPlayedMessage;
    expect(m.shooterId).toBe('A');
    expect(m.power).toBe(1);
    expect(m.dx).toBeCloseTo(0, 9);
    expect(m.dy).toBeCloseTo(1, 9);
    expect(m.balls.map((x) => x.id)).toEqual([0, 1, 2]);
    expect(m.durationMs).toBeGreaterThan(0);
    await waitFor(() => st(a).stage === 'aim' && st(a).shotNo === 1);
    const cue = st(a).balls.find((x) => x.id === 0);
    expect(cue?.y).not.toBe(0.6);
    expect(st(a).shooterId).toBe('B');
    expect(st(a).lastFoul).toBe('noHit');
    expect(st(a).rackScore.get('A')).toBe(-1);
    expect(st(a).phase).toBe('round');
  });

  it('aim timeout passes the turn with a penalty', async () => {
    const [a] = await startGame(server, 'scatterFast');
    await waitFor(() => st(a).lastFoul === 'timeout');
    expect(st(a).shooterId).toBe('B');
    expect(st(a).rackScore.get('A')).toBe(-1);
    expect(st(a).stage).toBe('aim');
  });

  it('relays aim to others but not to the sender, ignores non-shooter', async () => {
    const [a, b] = await startGame(server, 'scatter');
    send(b, MSG_AIM, { dx: 1, dy: 0, power: 0.5 });
    send(a, MSG_AIM, { dx: 2, dy: 0, power: 0.5 });
    await waitFor(() => b.aims.length === 1);
    await pause(100);
    expect(a.aims.length).toBe(0);
    expect(b.aims[0]).toMatchObject({ shooterId: 'A', dx: 1, dy: 0, power: 0.5 });
  });

  it('potting the last ball ends the rack and scores it', async () => {
    const [a] = await startGame(server, 'pot');
    send(a, MSG_SHOT, { dx: -1, dy: -1, power: 0.25, spinX: 0, spinY: 0 });
    await waitFor(() => st(a).phase === 'roundEnd', 4000);
    const ball1 = st(a).balls.find((x) => x.id === 1);
    expect(ball1?.potted).toBe(true);
    expect(ball1?.pottedBy).toBe('A');
    expect(st(a).stage).toBe('');
    expect(st(a).players.get('A')?.roundScore).toBe(2);
    expect(st(a).players.get('B')?.roundScore).toBe(0);
  });

  it('scratch: penalty, cue back in the kitchen, in hand for the next shooter', async () => {
    const [a] = await startGame(server, 'scratch');
    send(a, MSG_SHOT, { dx: -1, dy: -1, power: 0.25, spinX: 0, spinY: 0 });
    await waitFor(() => st(a).lastFoul === 'scratch' && st(a).stage === 'aim', 4000);
    const cue = st(a).balls.find((x) => x.id === 0);
    expect(cue?.potted).toBe(false);
    expect(cue?.x).toBeCloseTo(0.635, 3);
    expect(cue?.y).toBeCloseTo(0.635, 3);
    expect(st(a).cueInHand).toBe(true);
    expect(st(a).shooterId).toBe('B');
    expect(st(a).rackScore.get('A')).toBe(-2);
  });
});
