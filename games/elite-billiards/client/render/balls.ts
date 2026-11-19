import type { DrawBall } from '../types.js';
import type { View } from '../view.js';

const BASE_BY_ID: Record<number, string> = {
  1: '#ffd23a',
  2: '#ff8a2b',
  3: '#35d0e0',
  4: '#2f6be0',
  5: '#d8312f',
  6: '#2457b8',
  7: '#8a1c33',
  8: '#13935a',
};
const BASE_BY_KIND: Record<string, string> = {
  cue: '#f4efdc',
  small: '#ffd23a',
  std: '#2f6be0',
  big: '#8a1c33',
  giant: '#7a3fc4',
  gold: '#e0b33a',
};

export function ballColor(id: number, kind: string): string {
  if (kind === 'giant' || kind === 'gold' || kind === 'cue') return BASE_BY_KIND[kind] ?? '#ccc';
  return BASE_BY_ID[id] ?? BASE_BY_KIND[kind] ?? '#ccc';
}

type V3 = [number, number, number];

/** Ориентация шаров: единичный вектор «полюса» (на нём кружок с номиналом), крутится по ω. */
export class Orientation {
  private poles = new Map<number, V3>();

  get(id: number): V3 {
    let p = this.poles.get(id);
    if (!p) {
      // Лёгкий случайный наклон от id, чтобы номиналы не были идеально «в лоб».
      const a = id * 2.399;
      p = [Math.sin(a) * 0.35, Math.cos(a) * 0.35, 0.9];
      this.normalize(p);
      this.poles.set(id, p);
    }
    return p;
  }

  /** Поворот на ω·dt (Родриг). ω в осях стола (x вправо, y вверх, z к зрителю). */
  spin(id: number, wx: number, wy: number, wz: number, dt: number): void {
    const w = Math.sqrt(wx * wx + wy * wy + wz * wz);
    if (w < 1e-6) return;
    const th = w * dt;
    const kx = wx / w;
    const ky = wy / w;
    const kz = wz / w;
    const p = this.get(id);
    const c = Math.cos(th);
    const s = Math.sin(th);
    const dot = kx * p[0] + ky * p[1] + kz * p[2];
    const cx = ky * p[2] - kz * p[1];
    const cy = kz * p[0] - kx * p[2];
    const cz = kx * p[1] - ky * p[0];
    p[0] = p[0] * c + cx * s + kx * dot * (1 - c);
    p[1] = p[1] * c + cy * s + ky * dot * (1 - c);
    p[2] = p[2] * c + cz * s + kz * dot * (1 - c);
    this.normalize(p);
  }

  private normalize(p: V3): void {
    const l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1;
    p[0] /= l;
    p[1] /= l;
    p[2] /= l;
  }
}

export interface BallFx {
  /** Масштаб 0..1 (проваливание). */
  scale?: number;
  /** Затемнение 0..1. */
  dark?: number;
}

export function drawBallShadow(
  ctx: CanvasRenderingContext2D,
  view: View,
  b: DrawBall,
  fx?: BallFx,
): void {
  const p = view.toScreen(b.x, b.y);
  const R = b.r * view.scale * (fx?.scale ?? 1);
  const cx = p.x + R * 0.16;
  const cy = p.y + R * 0.24;
  const g = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.25);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawPole(
  ctx: CanvasRenderingContext2D,
  view: View,
  b: DrawBall,
  cx: number,
  cy: number,
  R: number,
  pole: V3,
): void {
  const pz = pole[2];
  if (pz <= 0.03) return;
  const v = view.vec(pole[0], pole[1]);
  const rd = R * 0.46;
  ctx.save();
  ctx.translate(cx + R * v.x, cy + R * v.y);
  ctx.rotate(Math.atan2(v.y, v.x));
  ctx.scale(pz, 1);
  if (b.kind === 'cue') {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(0, 0, rd * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fbfaf3';
    ctx.beginPath();
    ctx.arc(0, 0, rd, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16181f';
    ctx.font = `700 ${Math.max(6, rd * 1.2)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Текст «стоит» вдоль экрана: компенсируем поворот, сжатие остаётся (вдоль радиуса).
    ctx.rotate(-Math.atan2(v.y, v.x));
    ctx.fillText(String(b.value), 0, rd * 0.05);
  }
  ctx.restore();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  view: View,
  b: DrawBall,
  orient: Orientation,
  fx?: BallFx,
): void {
  const p = view.toScreen(b.x, b.y);
  const R = b.r * view.scale * (fx?.scale ?? 1);
  if (R < 0.5) return;
  const base = ballColor(b.id, b.kind);
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
  ctx.fill();
  if (b.kind === 'gold') {
    const gg = ctx.createLinearGradient(p.x - R, p.y - R, p.x + R, p.y + R);
    gg.addColorStop(0, '#fff3b0');
    gg.addColorStop(0.45, '#e0a92a');
    gg.addColorStop(1, '#8a5a10');
    ctx.fillStyle = gg;
    ctx.fill();
  }
  const pole = orient.get(b.id);
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
  ctx.clip();
  drawPole(ctx, view, b, p.x, p.y, R, pole);
  drawPole(ctx, view, b, p.x, p.y, R, [-pole[0], -pole[1], -pole[2]]);
  // Затенение к краю и блик.
  const sh = ctx.createRadialGradient(p.x - R * 0.28, p.y - R * 0.32, R * 0.15, p.x, p.y, R * 1.02);
  sh.addColorStop(0, 'rgba(255,255,255,0.22)');
  sh.addColorStop(0.5, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = sh;
  ctx.fillRect(p.x - R, p.y - R, 2 * R, 2 * R);
  if (fx?.dark) {
    ctx.fillStyle = `rgba(0,0,0,${fx.dark})`;
    ctx.fillRect(p.x - R, p.y - R, 2 * R, 2 * R);
  }
  ctx.restore();
  const spec = ctx.createRadialGradient(
    p.x - R * 0.38,
    p.y - R * 0.42,
    0,
    p.x - R * 0.38,
    p.y - R * 0.42,
    R * 0.28,
  );
  spec.addColorStop(0, 'rgba(255,255,255,0.85)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(p.x - R * 0.38, p.y - R * 0.42, R * 0.28, 0, Math.PI * 2);
  ctx.fill();
}
