import { predictFirstHit } from './physics/index.js';
import { E_BALL, V0_MAX, V0_MIN } from './physics/constants.js';
import { L, POCKETS, W, massOf } from './table.js';

/** Шар на столе для бота (прицельный: id > 0; биток: id 0). */
export interface BotBall {
  id: number;
  x: number;
  y: number;
  r: number;
  value: number;
}

export interface Candidate {
  targetId: number;
  /** Единичное направление битка. */
  dx: number;
  dy: number;
  /** Сила для «подобранной» дистанции. */
  power: number;
  /** Геометрическая оценка. */
  geo: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Смещение точки прицела внутрь лузы, м. */
const POCKET_DEEP = 0.02;
const MIN_COS = 0.25;
/** Средние замедления сукна для оценки силы (грубо, м/с²). */
const DECEL_BALL = 0.3;
const DECEL_CUE = 0.35;
const V_MARGIN = 0.3;

/** Точка прицела лузы: сама лузa, сдвинутая от центра стола наружу на POCKET_DEEP. */
export function pocketAimPoints(): Point[] {
  return POCKETS.map((p) => {
    const sx = p.x < L / 2 - 1e-9 ? -1 : p.x > L / 2 + 1e-9 ? 1 : 0;
    const sy = p.y < W / 2 - 1e-9 ? -1 : p.y > W / 2 + 1e-9 ? 1 : 0;
    const n = Math.sqrt(sx * sx + sy * sy);
    return { x: p.x + (sx / n) * POCKET_DEEP, y: p.y + (sy / n) * POCKET_DEEP };
  });
}

const AIM_POINTS = pocketAimPoints();

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey;
  let t = len2 > 1e-12 ? ((px - ax) * ex + (py - ay) * ey) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + ex * t - px;
  const cy = ay + ey * t - py;
  return Math.sqrt(cx * cx + cy * cy);
}

/** Сила удара (0..1), чтобы прицельный шар дошёл до лузы. */
export function powerFor(
  cosPhi: number,
  dCue: number,
  dBall: number,
  rCue: number,
  rTarget: number,
): number {
  const mc = massOf(rCue);
  const mt = massOf(rTarget);
  const vt = Math.sqrt(2 * DECEL_BALL * dBall) + V_MARGIN;
  const vHit = vt / (cosPhi * (1 + E_BALL) * (mc / (mc + mt)));
  const v0 = Math.sqrt(vHit * vHit + 2 * DECEL_CUE * dCue);
  const p = (v0 - V0_MIN) / (V0_MAX - V0_MIN);
  return p < 0.05 ? 0.05 : p > 1 ? 1 : p;
}

/** Все осмысленные удары «через призрак» для биток в (cx, cy), отсортированы по убыванию оценки. */
export function findCandidates(
  balls: readonly BotBall[],
  cx: number,
  cy: number,
  rCue: number,
): Candidate[] {
  const out: Candidate[] = [];
  const targets = balls.filter((b) => b.id > 0);
  const cue = { x: cx, y: cy, r: rCue };
  for (const t of targets) {
    for (const a of AIM_POINTS) {
      const ux0 = a.x - t.x;
      const uy0 = a.y - t.y;
      const dBall = Math.sqrt(ux0 * ux0 + uy0 * uy0);
      if (dBall < 1e-6) continue;
      const ux = ux0 / dBall;
      const uy = uy0 / dBall;
      const gx = t.x - ux * (t.r + rCue);
      const gy = t.y - uy * (t.r + rCue);
      const vx = gx - cx;
      const vy = gy - cy;
      const dCue = Math.sqrt(vx * vx + vy * vy);
      if (dCue < 1e-6) continue;
      const dx = vx / dCue;
      const dy = vy / dCue;
      const cosPhi = dx * ux + dy * uy;
      if (cosPhi < MIN_COS) continue;
      let blocked = false;
      for (const o of targets) {
        if (o.id === t.id) continue;
        if (distToSegment(o.x, o.y, t.x, t.y, a.x, a.y) < t.r + o.r) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const hit = predictFirstHit(targets, cue, dx, dy);
      if (hit.kind !== 'ball' || hit.targetId !== t.id) continue;
      const geo = (t.value * cosPhi * cosPhi) / (1 + dCue + 1.5 * dBall);
      out.push({ targetId: t.id, dx, dy, power: powerFor(cosPhi, dCue, dBall, rCue, t.r), geo });
    }
  }
  out.sort((p, q) => q.geo - p.geo);
  return out;
}

/** Ближайший шар, в который есть прямая видимость (иначе просто ближайший). */
export function safeDirection(
  balls: readonly BotBall[],
  cx: number,
  cy: number,
  rCue: number,
): { dx: number; dy: number } {
  const targets = balls.filter((b) => b.id > 0);
  const sorted = [...targets].sort(
    (p, q) => (p.x - cx) ** 2 + (p.y - cy) ** 2 - ((q.x - cx) ** 2 + (q.y - cy) ** 2),
  );
  let fallback: { dx: number; dy: number } = { dx: 1, dy: 0 };
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i] as BotBall;
    const vx = t.x - cx;
    const vy = t.y - cy;
    const d = Math.sqrt(vx * vx + vy * vy);
    if (d < 1e-6) continue;
    const dir = { dx: vx / d, dy: vy / d };
    if (i === 0) fallback = dir;
    const hit = predictFirstHit(targets, { x: cx, y: cy, r: rCue }, dir.dx, dir.dy);
    if (hit.kind === 'ball' && hit.targetId === t.id) return dir;
  }
  return fallback;
}
