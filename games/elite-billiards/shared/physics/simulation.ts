import { checkRest, stepCloth } from './cloth.js';
import { checkPockets, collideBalls, collideCushions } from './collide.js';
import { DT, MAX_STEPS } from './constants.js';
import { applyStrike } from './strike.js';
import { massOf } from '../table.js';
import type { ShotInput, ShotResult, SimBall, SimEvent, Simulation } from './types.js';

/** Округление позиций, которые сервер пишет в state. */
export function roundPos(x: number): number {
  return Math.round(x * 1e5) / 1e5;
}

export function createSimulation(input: ShotInput): Simulation {
  const balls: SimBall[] = input.balls
    .map((b): SimBall => ({
      id: b.id,
      r: b.r,
      m: massOf(b.r),
      x: b.x,
      y: b.y,
      vx: 0,
      vy: 0,
      wx: 0,
      wy: 0,
      wz: 0,
      potted: false,
      resting: true,
    }))
    .sort((a, b) => a.id - b.id);
  const cue = balls.find((b) => b.id === 0);
  if (cue) applyStrike(cue, input.dx, input.dy, input.power, input.spinX, input.spinY);

  let step = 0;
  let done = !cue;
  const sim = {
    balls,
    get step() {
      return step;
    },
    get done() {
      return done;
    },
    advance(): SimEvent[] {
      const events: SimEvent[] = [];
      if (done) return events;
      step++;
      for (const b of balls) if (!b.resting && !b.potted) stepCloth(b);
      for (const b of balls) {
        if (b.resting || b.potted) continue;
        b.x += b.vx * DT;
        b.y += b.vy * DT;
      }
      checkPockets(balls, step, events);
      collideBalls(balls, step, events);
      collideCushions(balls, step, events);
      let active = false;
      for (const b of balls) {
        checkRest(b);
        if (!b.resting && !b.potted) active = true;
      }
      if (!active || step >= MAX_STEPS) done = true;
      return events;
    },
  };
  return sim;
}

/** Прогон удара до конца (или MAX_STEPS). */
export function simulateShot(input: ShotInput): ShotResult {
  const sim = createSimulation(input);
  const potted: number[] = [];
  let firstHit = -1;
  while (!sim.done) {
    for (const e of sim.advance()) {
      if (e.type === 'pot') potted.push(e.ball);
      else if (e.type === 'ball' && firstHit < 0) {
        if (e.a === 0 && e.b > 0) firstHit = e.b;
        else if (e.b === 0 && e.a > 0) firstHit = e.a;
      }
    }
  }
  const final = sim.balls
    .filter((b) => !b.potted)
    .map((b) => ({ id: b.id, x: roundPos(b.x), y: roundPos(b.y) }));
  return { final, potted, firstHit, steps: sim.step, durationMs: Math.round(sim.step * DT * 1000) };
}
