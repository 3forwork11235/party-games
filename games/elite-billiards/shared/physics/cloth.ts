import { DT, G, MU_ROLL, MU_SLIDE, MU_SPIN, REST_U, REST_V, REST_WZ } from './constants.js';
import type { SimBall } from './types.js';

const SLIDE_EPS = 3.5 * MU_SLIDE * G * DT;
const ROLL_DEC = MU_ROLL * G * DT;

/** Действие сукна на один шар за шаг DT (скольжение → качение, сопротивление, винт). */
export function stepCloth(b: SimBall): void {
  const r = b.r;
  const ux = b.vx - r * b.wy;
  const uy = b.vy + r * b.wx;
  const um = Math.sqrt(ux * ux + uy * uy);
  if (um > SLIDE_EPS) {
    const k = (-MU_SLIDE * G) / um;
    const ax = ux * k;
    const ay = uy * k;
    b.vx += ax * DT;
    b.vy += ay * DT;
    b.wx += ((2.5 * ay) / r) * DT;
    b.wy -= ((2.5 * ax) / r) * DT;
  } else {
    b.vx -= ux * (2 / 7);
    b.vy -= uy * (2 / 7);
    const vm = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (vm <= ROLL_DEC) {
      b.vx = 0;
      b.vy = 0;
    } else {
      const s = ROLL_DEC / vm;
      b.vx -= b.vx * s;
      b.vy -= b.vy * s;
    }
    b.wx = -b.vy / r;
    b.wy = b.vx / r;
  }
  // Боковой винт затухает.
  const dec = ((2.5 * MU_SPIN * G) / r) * DT;
  if (b.wz > dec) b.wz -= dec;
  else if (b.wz < -dec) b.wz += dec;
  else b.wz = 0;
}

/** Если шар почти остановился — обнулить всё и пометить resting. */
export function checkRest(b: SimBall): void {
  if (b.resting || b.potted) return;
  if (b.vx * b.vx + b.vy * b.vy >= REST_V * REST_V) return;
  const ux = b.vx - b.r * b.wy;
  const uy = b.vy + b.r * b.wx;
  if (ux * ux + uy * uy >= REST_U * REST_U) return;
  if (Math.abs(b.wz) >= REST_WZ) return;
  b.vx = 0;
  b.vy = 0;
  b.wx = 0;
  b.wy = 0;
  b.wz = 0;
  b.resting = true;
}
