import { E_BALL, MU_BALL, MU_CUSHION } from './constants.js';
import { CUSHIONS, L, POCKETS, W } from '../table.js';
import type { SimBall, SimEvent } from './types.js';

/** Забитые шары: центр вышел за [0,L]×[0,W]. */
export function checkPockets(balls: SimBall[], step: number, events: SimEvent[]): void {
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i] as SimBall;
    if (b.potted) continue;
    if (b.x >= 0 && b.x <= L && b.y >= 0 && b.y <= W) continue;
    let best = 0;
    let bestD = Infinity;
    for (let p = 0; p < POCKETS.length; p++) {
      const pk = POCKETS[p] as { x: number; y: number };
      const dx = b.x - pk.x;
      const dy = b.y - pk.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    b.potted = true;
    b.resting = false;
    b.vx = 0;
    b.vy = 0;
    b.wx = 0;
    b.wy = 0;
    b.wz = 0;
    events.push({ type: 'pot', step, ball: b.id, pocket: best });
  }
}

function collidePair(a: SimBall, b: SimBall, step: number, events: SimEvent[]): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rs = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rs * rs) return;
  const d = Math.sqrt(d2);
  let nx: number;
  let ny: number;
  if (d > 1e-12) {
    nx = dx / d;
    ny = dy / d;
  } else {
    nx = 1;
    ny = 0;
  }
  // Позиционная коррекция пропорционально обратным массам.
  const o = rs - d;
  const ia = 1 / a.m;
  const ib = 1 / b.m;
  const isum = ia + ib;
  a.x -= nx * o * (ia / isum);
  a.y -= ny * o * (ia / isum);
  b.x += nx * o * (ib / isum);
  b.y += ny * o * (ib / isum);

  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (!(vn > 0)) return;
  const jn = ((1 + E_BALL) * vn) / isum;
  a.vx -= (jn / a.m) * nx;
  a.vy -= (jn / a.m) * ny;
  b.vx += (jn / b.m) * nx;
  b.vy += (jn / b.m) * ny;
  a.resting = false;
  b.resting = false;

  // Трение шар-шар («отброс»).
  const cax = a.vx + a.wz * a.r * -ny;
  const cay = a.vy + a.wz * a.r * nx;
  const cbx = b.vx + b.wz * b.r * ny;
  const cby = b.vy + b.wz * b.r * -nx;
  const rx = cax - cbx;
  const ry = cay - cby;
  const rn = rx * nx + ry * ny;
  const sx = rx - rn * nx;
  const sy = ry - rn * ny;
  const sm = Math.sqrt(sx * sx + sy * sy);
  if (sm > 1e-6) {
    const jt = Math.min(sm / (3.5 / a.m + 3.5 / b.m), MU_BALL * jn);
    const px = (-jt * sx) / sm;
    const py = (-jt * sy) / sm;
    a.vx += px / a.m;
    a.vy += py / a.m;
    b.vx -= px / b.m;
    b.vy -= py / b.m;
    const cross = nx * py - ny * px;
    a.wz += (a.r * cross) / (0.4 * a.m * a.r * a.r);
    b.wz += (b.r * cross) / (0.4 * b.m * b.r * b.r);
  }
  events.push({ type: 'ball', step, a: a.id, b: b.id, impulse: jn });
}

/** Шар-шар: все пары по возрастанию индекса, 2 прохода. */
export function collideBalls(balls: SimBall[], step: number, events: SimEvent[]): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i] as SimBall;
      if (a.potted) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j] as SimBall;
        if (b.potted || (a.resting && b.resting)) continue;
        collidePair(a, b, step, events);
      }
    }
  }
}

/** Борта и губки: ближайшая точка отрезка. */
export function collideCushions(balls: SimBall[], step: number, events: SimEvent[]): void {
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i] as SimBall;
    if (b.potted || b.resting) continue;
    for (let c = 0; c < CUSHIONS.length; c++) {
      const s = CUSHIONS[c] as (typeof CUSHIONS)[number];
      const ex = s.bx - s.ax;
      const ey = s.by - s.ay;
      let t = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / (ex * ex + ey * ey);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = s.ax + ex * t;
      const qy = s.ay + ey * t;
      const dx = b.x - qx;
      const dy = b.y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= b.r * b.r || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      b.x = qx + nx * b.r;
      b.y = qy + ny * b.r;
      const vn = -(b.vx * nx + b.vy * ny);
      if (!(vn > 0)) continue;
      const q4 = vn / 4;
      const ec = 0.82 - 0.1 * (q4 < 1 ? q4 : 1);
      b.vx += (1 + ec) * vn * nx;
      b.vy += (1 + ec) * vn * ny;
      // Трение с учётом винта.
      const cx = b.vx + b.wz * b.r * ny;
      const cy = b.vy + b.wz * b.r * -nx;
      const cn = cx * nx + cy * ny;
      const sx = cx - cn * nx;
      const sy = cy - cn * ny;
      const sm = Math.sqrt(sx * sx + sy * sy);
      if (sm > 1e-9) {
        const jt = Math.min(sm / 3.5, MU_CUSHION * (1 + ec) * vn);
        const px = (-jt * sx) / sm;
        const py = (-jt * sy) / sm;
        b.vx += px;
        b.vy += py;
        b.wz -= (2.5 * (nx * py - ny * px)) / b.r;
      }
      // Накат через борт: компонента качения вдоль n гасится наполовину.
      const tx = -ny;
      const ty = nx;
      const wt = b.wx * tx + b.wy * ty;
      b.wx -= 0.5 * wt * tx;
      b.wy -= 0.5 * wt * ty;
      b.resting = false;
      events.push({ type: 'cushion', step, ball: b.id, impulse: (1 + ec) * vn });
    }
  }
}
