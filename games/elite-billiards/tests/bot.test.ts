import { describe, expect, it } from 'vitest';
import { planBotShot, type BotBall } from '../shared/bot.js';
import { createRack, isValidCuePlacement } from '../shared/rack.js';
import { resolveShot } from '../shared/rules.js';
import { simulateShot } from '../shared/physics/index.js';
import { BALL_SPECS, L, W } from '../shared/table.js';
import type { BallKind } from '../shared/types.js';

/** Детерминированный rng (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ball = (id: number, kind: BallKind, x: number, y: number): BotBall => ({
  id,
  x,
  y,
  r: BALL_SPECS[kind].r,
  value: BALL_SPECS[kind].value,
});

function play(
  balls: BotBall[],
  shot: ReturnType<typeof planBotShot>,
): { points: number; foul: string } {
  const sim = balls.map((b) => ({
    id: b.id,
    x: b.id === 0 && shot.cueX !== undefined ? shot.cueX : b.x,
    y: b.id === 0 && shot.cueY !== undefined ? shot.cueY : b.y,
    r: b.r,
  }));
  const result = simulateShot({
    balls: sim,
    dx: shot.dx,
    dy: shot.dy,
    power: shot.power,
    spinX: shot.spinX,
    spinY: shot.spinY,
  });
  const values = new Map<number, number>();
  for (const b of balls) if (b.id > 0) values.set(b.id, b.value);
  const res = resolveShot({ result, values, cueInHand: false });
  return { points: res.points, foul: res.foul };
}

/** Простые позиции: шар перед лузой, биток на линии удара; второй шар далеко. */
const SIMPLE: BotBall[][] = [
  [ball(0, 'cue', 0.9, 0.9), ball(1, 'std', 0.3, 0.3), ball(2, 'small', 2.0, 0.2)],
  [ball(0, 'cue', 1.6, 0.35), ball(1, 'small', 1.9, 0.2), ball(2, 'big', 0.4, 1.0)],
  [ball(0, 'cue', 1.0, 0.8), ball(1, 'big', 1.27, 0.25), ball(2, 'std', 0.3, 1.0)],
  [ball(0, 'cue', 0.7, 0.5), ball(1, 'gold', 0.25, 1.0), ball(2, 'small', 2.2, 0.9)],
  [ball(0, 'cue', 1.5, 1.0), ball(1, 'std', 2.2, 1.05), ball(2, 'small', 0.5, 0.3)],
];

describe('planBotShot', () => {
  it('pots an easy ball in at least 9 of 10 seeds without noise', () => {
    const balls = SIMPLE[0] as BotBall[];
    let potted = 0;
    for (let s = 1; s <= 10; s++) {
      const shot = planBotShot(balls, false, seeded(s), { noise: 0 });
      if (play(balls, shot).points > 0) potted++;
    }
    expect(potted).toBeGreaterThanOrEqual(9);
  });

  it('simple positions: reports pot rate with default human error', () => {
    let potted = 0;
    let total = 0;
    for (const balls of SIMPLE) {
      for (let s = 1; s <= 10; s++) {
        const shot = planBotShot(balls, false, seeded(s * 7));
        const r = play(balls, shot);
        total++;
        if (r.points > 0) potted++;
        expect(r.foul).not.toBe('noHit');
      }
    }
    const rate = potted / total;
    console.log(
      `bot pot rate on simple positions: ${(rate * 100).toFixed(0)}% (${potted}/${total})`,
    );
    expect(rate).toBeGreaterThanOrEqual(0.6);
  });

  it('cue in hand: placement is valid and the shot plays', () => {
    const balls = SIMPLE[0] as BotBall[];
    for (let s = 1; s <= 5; s++) {
      const shot = planBotShot(balls, true, seeded(s));
      expect(shot.cueX).toBeDefined();
      expect(shot.cueY).toBeDefined();
      expect(isValidCuePlacement(shot.cueX as number, shot.cueY as number, balls)).toBe(true);
    }
  });

  it('with no pot candidates the shot still touches a ball (no noHit)', () => {
    // Все шары прижаты к углам за другими шарами: потенциальных забиваний нет.
    const balls = [
      ball(0, 'cue', 1.27, 0.64),
      ball(1, 'giant', 1.5, 0.64),
      ball(2, 'small', 1.545, 0.64),
    ];
    for (let s = 1; s <= 10; s++) {
      const shot = planBotShot(balls, false, seeded(s));
      expect(play(balls, shot).foul).not.toBe('noHit');
    }
  });

  it('never fouls noHit on rack positions with a visible ball', () => {
    const rack = createRack(seeded(3)) as BotBall[];
    for (let s = 1; s <= 10; s++) {
      const shot = planBotShot(rack, false, seeded(s));
      expect(play(rack, shot).foul).not.toBe('noHit');
    }
  });

  it('plans a scattered 10-ball table within 400 ms and pots something sometimes', () => {
    const kinds: BallKind[] = [
      'small',
      'small',
      'small',
      'std',
      'std',
      'std',
      'big',
      'big',
      'giant',
      'gold',
    ];
    const rng = seeded(11);
    let worst = 0;
    let potted = 0;
    for (let n = 0; n < 8; n++) {
      const balls: BotBall[] = [ball(0, 'cue', 0.6, 0.6)];
      kinds.forEach((k, i) => {
        const x = 0.15 + rng() * (L - 0.3);
        const y = 0.1 + rng() * (W - 0.2);
        const clear = balls.every(
          (b) => Math.hypot(b.x - x, b.y - y) > b.r + BALL_SPECS[k].r + 0.01,
        );
        if (clear) balls.push(ball(i + 1, k, x, y));
      });
      const t0 = performance.now();
      const shot = planBotShot(balls, false, seeded(n + 1));
      worst = Math.max(worst, performance.now() - t0);
      const r = play(balls, shot);
      if (r.points > 0) potted++;
      expect(r.foul).not.toBe('noHit');
    }
    console.log(`scattered: worst planBotShot ${worst.toFixed(0)} ms, potted ${potted}/8`);
    expect(worst).toBeLessThan(400);
  });

  it('plans a full rack within 400 ms', () => {
    const rack = createRack(seeded(5)) as BotBall[];
    planBotShot(rack, false, seeded(1));
    const t0 = performance.now();
    const shot = planBotShot(rack, false, seeded(2));
    const ms = performance.now() - t0;
    console.log(`planBotShot on full rack: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(400);
    expect(Math.hypot(shot.dx, shot.dy)).toBeCloseTo(1, 6);
    expect(shot.power).toBeGreaterThan(0);
    expect(L).toBeGreaterThan(W);
  });
});
