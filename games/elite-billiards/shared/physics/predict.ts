import { CUSHIONS, L, W } from '../table.js';

export interface PredictResult {
  kind: 'ball' | 'cushion' | 'none';
  /** Центр битка в момент первого контакта («шар-призрак»). */
  ghostX: number;
  ghostY: number;
  /** Расстояние от центра битка до призрака. */
  dist: number;
  targetId?: number;
  /** Направление прицельного шара (по линии центров). */
  targetDirX?: number;
  targetDirY?: number;
  /** Направление битка после касания (касательная, ⟂ линии центров). */
  cueDirX?: number;
  cueDirY?: number;
}

/**
 * Луч от центра битка: первый контакт с шаром (сумма радиусов) или бортом (отрезки, сдвинутые внутрь на r).
 * `balls` — прицельные шары на столе (id 0 и вне стола игнорируются). Точность «на глаз».
 */
export function predictFirstHit(
  balls: ReadonlyArray<{ id: number; x: number; y: number; r: number }>,
  cue: { x: number; y: number; r: number },
  dxIn: number,
  dyIn: number,
): PredictResult {
  const len = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
  if (!(len > 1e-9)) return { kind: 'none', ghostX: cue.x, ghostY: cue.y, dist: 0 };
  const dx = dxIn / len;
  const dy = dyIn / len;

  let bestT = Infinity;
  let bestBall: { id: number; x: number; y: number; r: number } | null = null;
  for (const b of balls) {
    if (b.id === 0) continue;
    const t = rayCircle(cue.x, cue.y, dx, dy, b.x, b.y, cue.r + b.r);
    if (t !== null && t < bestT) {
      bestT = t;
      bestBall = b;
    }
  }

  let cushionT = Infinity;
  for (const s of CUSHIONS) {
    const ex = s.bx - s.ax;
    const ey = s.by - s.ay;
    const el = Math.sqrt(ex * ex + ey * ey);
    const tx = ex / el;
    const ty = ey / el;
    // Нормаль внутрь стола.
    let nx = -ty;
    let ny = tx;
    if ((L / 2 - s.ax) * nx + (W / 2 - s.ay) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const denom = dx * nx + dy * ny;
    if (denom < -1e-12) {
      // Сдвинутая внутрь линия: (p - a)·n = r.
      const t = (cue.r - ((cue.x - s.ax) * nx + (cue.y - s.ay) * ny)) / denom;
      if (t >= 0) {
        const hx = cue.x + dx * t - s.ax;
        const hy = cue.y + dy * t - s.ay;
        const along = hx * tx + hy * ty;
        if (along >= 0 && along <= el && t < cushionT) cushionT = t;
      }
    }
    for (const [px, py] of [
      [s.ax, s.ay],
      [s.bx, s.by],
    ] as const) {
      const t = rayCircle(cue.x, cue.y, dx, dy, px, py, cue.r);
      if (t !== null && t < cushionT) cushionT = t;
    }
  }

  if (bestBall && bestT <= cushionT) {
    const gx = cue.x + dx * bestT;
    const gy = cue.y + dy * bestT;
    const ox = bestBall.x - gx;
    const oy = bestBall.y - gy;
    const ol = Math.sqrt(ox * ox + oy * oy);
    const nx = ol > 1e-12 ? ox / ol : dx;
    const ny = ol > 1e-12 ? oy / ol : dy;
    const dn = dx * nx + dy * ny;
    let cx = dx - dn * nx;
    let cy = dy - dn * ny;
    const cl = Math.sqrt(cx * cx + cy * cy);
    if (cl > 1e-9) {
      cx /= cl;
      cy /= cl;
    } else {
      cx = 0;
      cy = 0;
    }
    return {
      kind: 'ball',
      ghostX: gx,
      ghostY: gy,
      dist: bestT,
      targetId: bestBall.id,
      targetDirX: nx,
      targetDirY: ny,
      cueDirX: cx,
      cueDirY: cy,
    };
  }
  if (cushionT < Infinity) {
    return {
      kind: 'cushion',
      ghostX: cue.x + dx * cushionT,
      ghostY: cue.y + dy * cushionT,
      dist: cushionT,
    };
  }
  return { kind: 'none', ghostX: cue.x, ghostY: cue.y, dist: 0 };
}

/** Наименьшее t ≥ 0, при котором |p + t·d − c| = R (d — единичный). */
function rayCircle(
  px: number,
  py: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  R: number,
): number | null {
  const fx = px - cx;
  const fy = py - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - R * R;
  if (c < 0) return b < 0 ? 0 : null; // уже перекрываются: контакт сразу, если движемся навстречу
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}
