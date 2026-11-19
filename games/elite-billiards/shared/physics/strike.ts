import { MAX_TIP_OFFSET, V0_MAX, V0_MIN } from './constants.js';
import type { SimBall } from './types.js';

/** Удар кием по битку: задаёт v и ω (SPEC §5). Направление нормируется, power и spin клампятся. */
export function applyStrike(
  cue: SimBall,
  dxIn: number,
  dyIn: number,
  powerIn: number,
  spinXIn: number,
  spinYIn: number,
): void {
  const len = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
  const dx = len > 1e-12 ? dxIn / len : 1;
  const dy = len > 1e-12 ? dyIn / len : 0;
  const power = powerIn < 0 ? 0 : powerIn > 1 ? 1 : powerIn;
  let a = spinXIn;
  let b = spinYIn;
  const sl = Math.sqrt(a * a + b * b);
  if (sl > MAX_TIP_OFFSET) {
    a = (a / sl) * MAX_TIP_OFFSET;
    b = (b / sl) * MAX_TIP_OFFSET;
  }
  const v0 = V0_MIN + power * (V0_MAX - V0_MIN);
  const k = (2.5 * v0) / cue.r;
  cue.vx = v0 * dx;
  cue.vy = v0 * dy;
  cue.wx = -dy * (b * k);
  cue.wy = dx * (b * k);
  cue.wz = a * k;
  cue.resting = false;
}
