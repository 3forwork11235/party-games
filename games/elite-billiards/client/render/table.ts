import {
  CM,
  CUSHIONS,
  KITCHEN_X,
  FOOT_SPOT,
  HEAD_SPOT,
  L,
  POCKETS,
  SM,
  W,
} from '../../shared/table.js';
import { RAIL, type View } from '../view.js';

const CUSHION_W = 0.05;

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function drawWood(ctx: CanvasRenderingContext2D): void {
  const x0 = -RAIL;
  const y0 = -RAIL;
  const w = L + 2 * RAIL;
  const h = W + 2 * RAIL;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, '#6b3a1e');
  g.addColorStop(0.5, '#4a2512');
  g.addColorStop(1, '#2f170b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 0.05);
  ctx.fill();
  const rnd = lcg(7);
  ctx.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const y = y0 + rnd() * h;
    const xa = x0 + rnd() * w;
    const len = 0.2 + rnd() * 0.9;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,190,120,0.07)' : 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 0.0015 + rnd() * 0.003;
    ctx.beginPath();
    ctx.moveTo(xa, y);
    ctx.quadraticCurveTo(
      xa + len / 2,
      y + (rnd() - 0.5) * 0.02,
      xa + len,
      y + (rnd() - 0.5) * 0.01,
    );
    ctx.stroke();
  }
  // Фаска и блики по краю.
  ctx.lineWidth = 0.004;
  ctx.strokeStyle = 'rgba(255,215,160,0.28)';
  ctx.beginPath();
  ctx.roundRect(x0 + 0.004, y0 + 0.004, w - 0.008, h - 0.008, 0.045);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.006;
  ctx.strokeRect(
    -CUSHION_W - 0.004,
    -CUSHION_W - 0.004,
    L + 2 * CUSHION_W + 0.008,
    W + 2 * CUSHION_W + 0.008,
  );
}

function drawCloth(ctx: CanvasRenderingContext2D): void {
  const e = CUSHION_W + 0.01;
  const g = ctx.createRadialGradient(L / 2, W / 2, 0.1, L / 2, W / 2, L * 0.62);
  g.addColorStop(0, '#1f7a52');
  g.addColorStop(0.6, '#155c3d');
  g.addColorStop(1, '#0a3323');
  ctx.fillStyle = g;
  ctx.fillRect(-e, -e, L + 2 * e, W + 2 * e);
  // Линия дома, точки.
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.moveTo(KITCHEN_X, 0);
  ctx.lineTo(KITCHEN_X, W);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (const p of [HEAD_SPOT, FOOT_SPOT, { x: L / 2, y: W / 2 }]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.007, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPockets(ctx: CanvasRenderingContext2D): void {
  POCKETS.forEach((p, i) => {
    const mid = i >= 4;
    const r = mid ? SM * 0.62 : CM * 0.72;
    const off = mid ? 0.012 : 0.026;
    const cx = p.x + (mid ? 0 : p.x === 0 ? -off : off);
    const cy = p.y + (p.y === 0 ? -off : off);
    ctx.fillStyle = '#b08a3c';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.012, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#000');
    g.addColorStop(0.7, '#05080a');
    g.addColorStop(1, '#18221c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCushions(ctx: CanvasRenderingContext2D): void {
  for (const c of CUSHIONS) {
    const dx = c.bx - c.ax;
    const dy = c.by - c.ay;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    // Наружная нормаль: от центра стола.
    const mx = (c.ax + c.bx) / 2 - L / 2;
    const my = (c.ay + c.by) / 2 - W / 2;
    let nx = -uy;
    let ny = ux;
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    const k = CUSHION_W;
    const g = ctx.createLinearGradient(c.ax, c.ay, c.ax + nx * k, c.ay + ny * k);
    g.addColorStop(0, '#2c9468');
    g.addColorStop(0.25, '#16694a');
    g.addColorStop(1, '#0b3a28');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c.ax, c.ay);
    ctx.lineTo(c.bx, c.by);
    ctx.lineTo(c.bx + ux * k + nx * k, c.by + uy * k + ny * k);
    ctx.lineTo(c.ax - ux * k + nx * k, c.ay - uy * k + ny * k);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,255,220,0.35)';
    ctx.lineWidth = 0.0025;
    ctx.beginPath();
    ctx.moveTo(c.ax, c.ay);
    ctx.lineTo(c.bx, c.by);
    ctx.stroke();
  }
}

function drawDiamonds(ctx: CanvasRenderingContext2D): void {
  const off = CUSHION_W + (RAIL - CUSHION_W) / 2;
  const d = 0.011;
  const dia = (x: number, y: number): void => {
    ctx.fillStyle = '#efe4c8';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.0012;
    ctx.beginPath();
    ctx.moveTo(x, y - d);
    ctx.lineTo(x + d * 0.7, y);
    ctx.lineTo(x, y + d);
    ctx.lineTo(x - d * 0.7, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  for (let k = 1; k <= 7; k++) {
    if (k === 4) continue;
    dia((L / 8) * k, -off);
    dia((L / 8) * k, W + off);
  }
  for (let k = 1; k <= 3; k++) {
    dia(-off, (W / 4) * k);
    dia(L + off, (W / 4) * k);
  }
}

/** Рисует статичный стол на ctx (трансформация должна быть уже установлена: метры). */
export function drawTable(ctx: CanvasRenderingContext2D): void {
  drawWood(ctx);
  drawCloth(ctx);
  drawPockets(ctx);
  drawCushions(ctx);
  drawDiamonds(ctx);
}

/** Кэш стола: рисует в offscreen-холст под текущий view/dpr. */
export function renderTableCache(view: View, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(view.w * dpr));
  c.height = Math.max(1, Math.round(view.h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const m = view.matrix;
  ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr);
  drawTable(ctx);
  return c;
}
