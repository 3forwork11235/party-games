import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { EliteBilliardsRoom } from '../server/EliteBilliardsRoom.js';
import {
  BALL_SPECS,
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

/** Два лёгких шара: у бота есть что забивать. */
const EASY = [ball(0, 'cue', 0.9, 0.9), ball(1, 'std', 0.3, 0.3), ball(2, 'small', 2.0, 0.2)];
/** Единственный шар по диагонали на угловую лузу. */
const LAST = [ball(0, 'cue', 0.4, 0.4), ball(1, 'std', 0.2, 0.2)];

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
    protected botThinkMs = [30, 80] as const;
    protected botAimLeadMs = 20;
  };
}

interface View {
  phase: string;
  stage: string;
  shooterId: string;
  shotNo: number;
  players: Map<string, unknown>;
  balls: Array<{ id: number; potted: boolean; pottedBy: string }>;
}

const st = (r: Room<unknown>): View => r.state as unknown as View;
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const opts = (id: string): object => ({ playerId: id, nick: id, avatar: '\u{1F436}', lang: 'ru' });

async function waitFor(pred: () => boolean, timeoutMs = 5000): Promise<void> {
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
        gs.define('easy', makeRoom(EASY, 4000));
        gs.define('last', makeRoom(LAST, 300));
      },
    },
    2592,
  );
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

async function startWithBot(name: string): Promise<{
  a: Room<unknown>;
  played: ShotPlayedMessage[];
  aims: AimOfMessage[];
}> {
  const a = await server.sdk.create(name, opts('A'));
  const played: ShotPlayedMessage[] = [];
  const aims: AimOfMessage[] = [];
  a.onMessage(MSG_SHOT_PLAYED, (m: ShotPlayedMessage) => played.push(m));
  a.onMessage(MSG_AIM_OF, (m: AimOfMessage) => aims.push(m));
  await waitFor(() => st(a).players.size === 1);
  a.send('core:addBot', {});
  await waitFor(() => st(a).players.size === 2);
  a.send('core:start', {});
  await waitFor(() => st(a).phase === 'round' && st(a).stage === 'aim');
  return { a, played, aims };
}

describe('EliteBilliardsRoom: боты', () => {
  it('бот сам бьёт в свой ход, прицел приходит заранее, ход возвращается человеку', async () => {
    const { a, played, aims } = await startWithBot('easy');
    expect(st(a).shooterId).toBe('A');
    a.send(MSG_SHOT, { dx: 0, dy: 1, power: 0, spinX: 0, spinY: 0 });
    await waitFor(() => played.some((m) => m.shooterId.startsWith('bot:')));
    const botShot = played.find((m) => m.shooterId.startsWith('bot:')) as ShotPlayedMessage;
    expect(botShot.power).toBeGreaterThan(0);
    expect(aims.some((m) => m.shooterId === botShot.shooterId)).toBe(true);
    await waitFor(() => st(a).stage === 'aim' && st(a).shotNo >= 2);
    expect(st(a).phase).toBe('round');
  });

  it('человек молчит (таймаут), бот забивает последний шар и раскладка заканчивается', async () => {
    const { a } = await startWithBot('last');
    await waitFor(() => st(a).phase === 'roundEnd', 8000);
    const b1 = st(a).balls.find((b) => b.id === 1);
    expect(b1?.potted).toBe(true);
    expect(b1?.pottedBy.startsWith('bot:')).toBe(true);
  }, 12000);
});
