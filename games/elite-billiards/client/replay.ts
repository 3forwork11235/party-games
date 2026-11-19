import { createSimulation, DT } from '../shared/physics/index.js';
import type { SimBall, SimEvent, Simulation } from '../shared/physics/types.js';
import type { ShotPlayedMessage } from '../shared/messages.js';
import { BALL_SPECS } from '../shared/table.js';
import type { BallKind } from '../shared/types.js';
import type { BallMeta } from './types.js';

const MAX_STEPS_PER_FRAME = 2000;
const STEP_MS = DT * 1000;

export interface TickResult {
  events: SimEvent[];
  steps: number;
}

/** Проигрывание MSG_SHOT_PLAYED через createSimulation в реальном времени. */
export class Replay {
  private sim: Simulation | null = null;
  private acc = 0;
  private lastMs = 0;
  /** state.shotNo в момент старта (до разрешения удара). */
  startShotNo = 0;
  sawRolling = false;

  get active(): boolean {
    return this.sim !== null;
  }

  get balls(): readonly SimBall[] {
    return this.sim?.balls ?? [];
  }

  start(
    msg: ShotPlayedMessage,
    meta: ReadonlyMap<number, BallMeta>,
    nowMs: number,
    shotNo: number,
  ): void {
    this.sim = createSimulation({
      balls: msg.balls.map((b) => {
        const m = meta.get(b.id);
        const r = m?.r ?? BALL_SPECS[(b.id === 0 ? 'cue' : 'std') as BallKind].r;
        return { id: b.id, x: b.x, y: b.y, r };
      }),
      dx: msg.dx,
      dy: msg.dy,
      power: msg.power,
      spinX: msg.spinX,
      spinY: msg.spinY,
    });
    this.acc = 0;
    this.lastMs = nowMs;
    this.startShotNo = shotNo;
    this.sawRolling = false;
  }

  tick(nowMs: number): TickResult {
    const out: TickResult = { events: [], steps: 0 };
    const sim = this.sim;
    if (!sim) return out;
    this.acc += Math.max(0, nowMs - this.lastMs);
    this.lastMs = nowMs;
    if (sim.done) {
      this.acc = 0;
      return out;
    }
    let n = Math.min(MAX_STEPS_PER_FRAME, Math.floor(this.acc / STEP_MS));
    this.acc -= n * STEP_MS;
    while (n-- > 0 && !sim.done) {
      for (const e of sim.advance()) out.events.push(e);
      out.steps++;
    }
    return out;
  }

  /** Досчитать до конца мгновенно. */
  finish(): void {
    const sim = this.sim;
    if (!sim) return;
    while (!sim.done) sim.advance();
  }

  clear(): void {
    this.sim = null;
    this.acc = 0;
  }
}
