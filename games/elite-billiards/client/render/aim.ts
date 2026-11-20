import { predictFirstHit } from '../../shared/physics/index.js';
import { KITCHEN_X, W } from '../../shared/table.js';
import type { AimHint } from '../settings.js';
import type { AimState, DrawBall } from '../types.js';
import type { View } from '../view.js';

/** Линия прицела до шара-призрака, направление прицельного шара и касательная битка. */
export function drawAimLine(
  ctx: CanvasRenderingContext2D,
  view: View,
  balls: readonly DrawBall[],
  cue: DrawBall,
  aim: AimState,
  alpha: number,
  mode: AimHint = 'full',
): void {
  if (mode === 'off') return;
  const pr = predictFirstHit(balls, { x: cue.x, y: cue.y, r: cue.r }, aim.dx, aim.dy);
  const a = view.toScreen(cue.x, cue.y);
  const end =
    pr.kind === 'none'
      ? { x: cue.x + aim.dx * 3, y: cue.y + aim.dy * 3 }
      : { x: pr.ghostX, y: pr.ghostY };
  const b = view.toScreen(end.x, end.y);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const R = cue.r * view.scale;
  if (pr.kind !== 'none') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (mode === 'full' && pr.kind === 'ball' && pr.targetId !== undefined) {
    const len = 0.28 * view.scale;
    const hit = balls.find((q) => q.id === pr.targetId);
    if (hit && pr.targetDirX !== undefined && pr.targetDirY !== undefined) {
      const c = view.toScreen(hit.x, hit.y);
      const v = view.vec(pr.targetDirX, pr.targetDirY);
      ctx.strokeStyle = 'rgba(255,230,120,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + v.x * len, c.y + v.y * len);
      ctx.stroke();
    }
    if (pr.cueDirX !== undefined && pr.cueDirY !== undefined) {
      const v = view.vec(pr.cueDirX, pr.cueDirY);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + v.x * len * 0.7, b.y + v.y * len * 0.7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Кий позади битка, отведён по силе. */
export function drawCue(
  ctx: CanvasRenderingContext2D,
  view: View,
  cue: DrawBall,
  aim: AimState,
  alpha: number,
): void {
  const gap = cue.r * 1.5 + aim.power * 0.22;
  const length = 1.35;
  const t0 = view.toScreen(cue.x - aim.dx * gap, cue.y - aim.dy * gap);
  const t1 = view.toScreen(cue.x - aim.dx * (gap + length), cue.y - aim.dy * (gap + length));
  const ang = Math.atan2(t1.y - t0.y, t1.x - t0.x);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const w0 = 0.0055 * view.scale;
  const w1 = 0.0135 * view.scale;
  const g = ctx.createLinearGradient(t0.x, t0.y, t1.x, t1.y);
  g.addColorStop(0, '#e8d6a8');
  g.addColorStop(0.55, '#c99a5b');
  g.addColorStop(0.58, '#2a1a10');
  g.addColorStop(1, '#14100c');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(t0.x + nx * w0, t0.y + ny * w0);
  ctx.lineTo(t1.x + nx * w1, t1.y + ny * w1);
  ctx.lineTo(t1.x - nx * w1, t1.y - ny * w1);
  ctx.lineTo(t0.x - nx * w0, t0.y - ny * w0);
  ctx.closePath();
  ctx.fill();
  const tip = 0.012 * view.scale;
  ctx.fillStyle = '#5ab0e8';
  ctx.beginPath();
  ctx.moveTo(t0.x + nx * w0, t0.y + ny * w0);
  ctx.lineTo(t0.x - nx * w0, t0.y - ny * w0);
  ctx.lineTo(t0.x + Math.cos(ang) * tip - nx * w0, t0.y + Math.sin(ang) * tip - ny * w0);
  ctx.lineTo(t0.x + Math.cos(ang) * tip + nx * w0, t0.y + Math.sin(ang) * tip + ny * w0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Подсветка дома при «биток с руки». */
export function drawKitchen(
  ctx: CanvasRenderingContext2D,
  view: View,
  now: number,
  valid: boolean,
): void {
  const a = view.toScreen(0, 0);
  const b = view.toScreen(KITCHEN_X, W);
  const pulse = 0.12 + 0.06 * Math.sin(now / 280);
  ctx.save();
  ctx.fillStyle = valid ? `rgba(255,236,150,${pulse})` : `rgba(255,70,70,${pulse + 0.05})`;
  ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.restore();
}

/** Красное кольцо вокруг битка при недопустимой позиции. */
export function drawInvalidCue(ctx: CanvasRenderingContext2D, view: View, cue: DrawBall): void {
  const p = view.toScreen(cue.x, cue.y);
  ctx.save();
  ctx.strokeStyle = '#ff4d4d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, cue.r * view.scale + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
