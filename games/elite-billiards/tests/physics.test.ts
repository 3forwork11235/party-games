import { describe, expect, it } from 'vitest';
import { MAX_STEPS } from '../shared/physics/constants.js';
import { predictFirstHit } from '../shared/physics/predict.js';
import { createSimulation, simulateShot } from '../shared/physics/simulation.js';
import type { ShotInput, SimBall, SimEvent } from '../shared/physics/types.js';
import { createRack, isValidCuePlacement } from '../shared/rack.js';
import { KITCHEN_X, L, W } from '../shared/table.js';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RC = 0.0286;
const cueBall = (x: number, y: number) => ({ id: 0, x, y, r: RC });
const ball = (id: number, x: number, y: number, r = RC) => ({ id, x, y, r });
const shot = (balls: ShotInput['balls'], p: Partial<ShotInput> = {}): ShotInput => ({
  balls,
  dx: 1,
  dy: 0,
  power: 0.5,
  spinX: 0,
  spinY: 0,
  ...p,
});

function energy(balls: readonly SimBall[]): number {
  let e = 0;
  for (const b of balls) {
    if (b.potted) continue;
    e += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
    e += 0.2 * b.m * b.r * b.r * (b.wx * b.wx + b.wy * b.wy + b.wz * b.wz);
  }
  return e;
}

function runUntil(
  input: ShotInput,
  pred: (e: SimEvent) => boolean,
): { sim: ReturnType<typeof createSimulation>; hit: SimEvent | null } {
  const sim = createSimulation(input);
  while (!sim.done) {
    for (const e of sim.advance()) if (pred(e)) return { sim, hit: e };
  }
  return { sim, hit: null };
}

describe('физика: базовые свойства', () => {
  it('детерминизм: два прогона идентичны', () => {
    const rack = createRack(mulberry32(5));
    const input = shot(rack, { dx: 1, dy: 0.01, power: 0.9, spinX: 0.2, spinY: -0.1 });
    expect(simulateShot(input)).toEqual(simulateShot(input));
    const a = createSimulation(input);
    const b = createSimulation(input);
    for (let i = 0; i < 3000; i++) {
      expect(a.advance()).toEqual(b.advance());
    }
    expect(a.balls).toEqual(b.balls);
  });

  it('сохранение импульса при столкновении (разные массы)', () => {
    const input = shot([cueBall(0.6, 0.6), ball(1, 1.1, 0.62, 0.042)], { dy: 0.04, power: 0.4 });
    const sim = createSimulation(input);
    const mom = (): [number, number] => {
      let px = 0;
      let py = 0;
      for (const b of sim.balls) {
        px += b.m * b.vx;
        py += b.m * b.vy;
      }
      return [px, py];
    };
    let before = mom();
    let found = false;
    while (!sim.done && !found) {
      before = mom();
      found = sim.advance().some((e) => e.type === 'ball');
    }
    expect(found).toBe(true);
    const after = mom();
    // За один шаг сукно меняет импульс не более чем на ~μ·g·DT·m.
    expect(Math.abs(after[0] - before[0])).toBeLessThan(0.01 * Math.abs(before[0]));
    expect(Math.abs(after[1] - before[1])).toBeLessThan(0.01 * Math.abs(before[0]));
  });

  it('«стоп»-удар равными шарами: биток почти останавливается', () => {
    const input = shot([cueBall(0.5, W / 2), ball(1, 1.0, W / 2)], { power: 0.2 });
    const { sim, hit } = runUntil(input, (e) => e.type === 'ball');
    expect(hit).not.toBeNull();
    const [c, t] = sim.balls as [SimBall, SimBall];
    const sc = Math.sqrt(c.vx ** 2 + c.vy ** 2);
    const st = Math.sqrt(t.vx ** 2 + t.vy ** 2);
    expect(st).toBeGreaterThan(0.3);
    expect(sc).toBeLessThan(0.1 * st);
  });

  it('лёгкий small отскакивает от стоящего giant назад', () => {
    const balls = [ball(0, 0.8, 0.4, 0.022), ball(1, 1.2, 0.4, 0.042)];
    const { sim, hit } = runUntil(shot(balls, { power: 0.5 }), (e) => e.type === 'ball');
    expect(hit).not.toBeNull();
    const [c, g] = sim.balls as [SimBall, SimBall];
    expect(c.vx).toBeLessThan(-0.5);
    expect(g.vx).toBeGreaterThan(0);
    expect(g.vx).toBeLessThan(0.6 * Math.abs(c.vx) + 1);
  });

  it('накат b=0.4 после столкновения катится вперёд, «стоп» — нет', () => {
    const follow = (b: number): number => {
      const input = shot([cueBall(0.85, W / 2), ball(1, 1.0, W / 2)], { power: 0.3, spinY: b });
      const { sim } = runUntil(input, (e) => e.type === 'ball');
      const c = sim.balls[0] as SimBall;
      const x0 = c.x;
      for (let i = 0; i < 600; i++) sim.advance();
      return c.x - x0;
    };
    expect(follow(0.4)).toBeGreaterThan(0.1);
    expect(follow(0)).toBeLessThan(0.08);
    expect(follow(0) * 3).toBeLessThan(follow(0.4));
    expect(follow(-0.4)).toBeLessThan(0);
  });

  it('энергия не растёт между шагами (разбой)', () => {
    const rack = createRack(mulberry32(11));
    const sim = createSimulation(shot(rack, { power: 0.8, spinY: 0.2, spinX: 0.15 }));
    let prev = energy(sim.balls);
    let worst = 0;
    while (!sim.done) {
      sim.advance();
      const e = energy(sim.balls);
      worst = Math.max(worst, e - prev);
      prev = e;
    }
    expect(worst).toBeLessThan(1e-3);
  });

  it('нет туннелирования на максимальной силе', () => {
    for (const dy of [0, 0.3, -0.7]) {
      const len = Math.sqrt(1 + dy * dy);
      const sim = createSimulation(
        shot([cueBall(0.5, W / 2), ball(1, 1.5, W / 2 + 0.01, 0.022)], {
          dx: 1 / len,
          dy: dy / len,
          power: 1,
        }),
      );
      let maxX = 0;
      while (!sim.done) {
        sim.advance();
        for (const b of sim.balls) if (!b.potted) maxX = Math.max(maxX, b.x);
      }
      expect(maxX).toBeLessThanOrEqual(L);
    }
    // Быстрый small через центр гиганта не проходит насквозь.
    const { sim, hit } = runUntil(
      shot([ball(0, 0.5, W / 2, 0.022), ball(1, 0.9, W / 2, 0.042)], { power: 1 }),
      (e) => e.type === 'ball',
    );
    expect(hit).not.toBeNull();
    const [c, g] = sim.balls as [SimBall, SimBall];
    expect(c.x).toBeLessThan(g.x);
  });
});

describe('физика: лузы и борта', () => {
  it('прямой удар в угловую лузу забивает', () => {
    const input = shot([cueBall(0.6, 0.6), ball(1, 0.3, 0.3)], {
      dx: -0.7071067811865476,
      dy: -0.7071067811865476,
      power: 0.5,
    });
    const events: SimEvent[] = [];
    const sim = createSimulation(input);
    while (!sim.done) events.push(...sim.advance());
    const pot = events.find((e) => e.type === 'pot' && e.ball === 1);
    expect(pot).toMatchObject({ pocket: 0 });
    const res = simulateShot(input);
    expect(res.potted).toContain(1);
    expect(res.firstHit).toBe(1);
  });

  it('гигант (r=0.042) забивается в среднюю лузу', () => {
    const input = shot([cueBall(L / 2, 0.75), ball(1, L / 2, 0.3, 0.042)], {
      dx: 0,
      dy: -1,
      power: 1,
    });
    const events: SimEvent[] = [];
    const sim = createSimulation(input);
    while (!sim.done) events.push(...sim.advance());
    expect(events.find((e) => e.type === 'pot' && e.ball === 1)).toMatchObject({ pocket: 4 });
  });

  it('гигант проходит в угловой створ по диагонали', () => {
    const input = shot([cueBall(0.9, 0.9), ball(1, 0.5, 0.5, 0.042)], {
      dx: -0.7071067811865476,
      dy: -0.7071067811865476,
      power: 0.9,
    });
    expect(simulateShot(input).potted).toContain(1);
  });

  it('правый винт об борт отклоняет отскок вправо от стрелка', () => {
    const afterBounce = (spinX: number): number => {
      const { sim, hit } = runUntil(
        shot([cueBall(1.5, W / 2)], { power: 0.5, spinX }),
        (e) => e.type === 'cushion',
      );
      expect(hit).not.toBeNull();
      for (let i = 0; i < 20; i++) sim.advance();
      return (sim.balls[0] as SimBall).vy;
    };
    // Стреляем в +x: «право» = (0, -1).
    expect(afterBounce(0)).toBeCloseTo(0, 6);
    expect(afterBounce(0.4)).toBeLessThan(-0.05);
    expect(afterBounce(-0.4)).toBeGreaterThan(0.05);
  });

  it('разбой power=1 заканчивается быстрее 25 с', () => {
    for (const seed of [1, 2, 3]) {
      const rack = createRack(mulberry32(seed));
      const res = simulateShot(shot(rack, { dx: 1, dy: 0, power: 1 }));
      expect(res.steps).toBeLessThan(MAX_STEPS);
      expect(res.durationMs).toBeLessThan(25000);
      expect(res.firstHit).toBeGreaterThan(0);
    }
  });
});

describe('физика: фаззинг', () => {
  it('300 случайных ударов: нет перекрытий > 0.5 мм, нет вылета, конечные числа', () => {
    const rng = mulberry32(2024);
    let maxOverlap = 0;
    for (let n = 0; n < 300; n++) {
      const rack = createRack(rng);
      // Каждый второй удар — после «разбоя» меньшей пирамиды; биток с руки в случайной точке дома.
      let cx = HEAD_SPOT_X(rng);
      let cy = 0.05 + rng() * (W - 0.1);
      let tries = 0;
      while (!isValidCuePlacement(cx, cy, rack) && tries++ < 50) {
        cx = HEAD_SPOT_X(rng);
        cy = 0.05 + rng() * (W - 0.1);
      }
      const balls = rack.map((b) => (b.id === 0 ? { ...b, x: cx, y: cy } : b));
      const ang = rng() * Math.PI * 2;
      const sa = rng() * Math.PI * 2;
      const sr = rng() * 0.5;
      const input: ShotInput = {
        balls,
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        power: rng(),
        spinX: Math.cos(sa) * sr,
        spinY: Math.sin(sa) * sr,
      };
      const sim = createSimulation(input);
      while (!sim.done) {
        sim.advance();
        if (sim.step % 5 !== 0) continue;
        for (let i = 0; i < sim.balls.length; i++) {
          const a = sim.balls[i] as SimBall;
          if (a.potted) continue;
          expect(Number.isFinite(a.x + a.y + a.vx + a.vy + a.wz)).toBe(true);
          expect(a.x >= 0 && a.x <= L && a.y >= 0 && a.y <= W).toBe(true);
          for (let j = i + 1; j < sim.balls.length; j++) {
            const b = sim.balls[j] as SimBall;
            if (b.potted) continue;
            const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
            maxOverlap = Math.max(maxOverlap, a.r + b.r - d);
          }
        }
      }
      expect(sim.step).toBeLessThanOrEqual(MAX_STEPS);
    }
    expect(maxOverlap).toBeLessThan(0.0005);
  }, 180000);
});

function HEAD_SPOT_X(rng: () => number): number {
  return 0.04 + rng() * (KITCHEN_X - 0.04);
}

describe('predictFirstHit', () => {
  it('прямой удар: призрак на сумме радиусов, направления', () => {
    const r = predictFirstHit([ball(1, 1.0, W / 2)], cueBall(0.5, W / 2), 1, 0);
    expect(r.kind).toBe('ball');
    expect(r.targetId).toBe(1);
    expect(r.ghostX).toBeCloseTo(1.0 - 2 * RC, 9);
    expect(r.targetDirX).toBeCloseTo(1, 9);
    expect(r.cueDirX).toBeCloseTo(0, 9);
  });

  it('скользящий удар: биток уходит по касательной', () => {
    const r = predictFirstHit([ball(1, 1.0, W / 2)], cueBall(0.5, W / 2 + RC), 1, 0);
    expect(r.kind).toBe('ball');
    expect(Math.abs(r.targetDirY ?? 0)).toBeGreaterThan(0.3);
    const dot = (r.targetDirX ?? 0) * (r.cueDirX ?? 0) + (r.targetDirY ?? 0) * (r.cueDirY ?? 0);
    expect(dot).toBeCloseTo(0, 9);
  });

  it('борт: призрак смещён внутрь на r; мимо шара — борт', () => {
    const r = predictFirstHit([ball(1, 1.0, 0.3)], cueBall(0.5, W / 2), 1, 0);
    expect(r.kind).toBe('cushion');
    expect(r.ghostX).toBeCloseTo(L - RC, 9);
    const up = predictFirstHit([], cueBall(0.5, 0.5), 0, 1);
    expect(up.kind).toBe('cushion');
    expect(up.ghostY).toBeCloseTo(W - RC, 9);
  });

  it('совпадает с реальным первым касанием симуляции', () => {
    const rack = createRack(mulberry32(9));
    const dx = 0.99;
    const dy = 0.1;
    const l = Math.sqrt(dx * dx + dy * dy);
    const pr = predictFirstHit(
      rack,
      rack[0] as { x: number; y: number; r: number },
      dx / l,
      dy / l,
    );
    const res = simulateShot(shot(rack, { dx: dx / l, dy: dy / l, power: 0.3 }));
    expect(pr.kind).toBe('ball');
    expect(res.firstHit).toBe(pr.targetId);
  });
});
