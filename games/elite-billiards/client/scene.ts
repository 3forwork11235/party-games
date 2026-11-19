import { drawAimLine, drawCue, drawInvalidCue, drawKitchen } from './render/aim.js';
import { drawBall, drawBallShadow, type Orientation } from './render/balls.js';
import type { AimState, DrawBall } from './types.js';
import type { View } from './view.js';

export const POT_MS = 250;

export interface PotAnim {
  ball: DrawBall;
  px: number;
  py: number;
  t0: number;
}

export interface SceneInput {
  g: CanvasRenderingContext2D;
  view: View;
  cache: HTMLCanvasElement | null;
  dpr: number;
  now: number;
  balls: readonly DrawBall[];
  orient: Orientation;
  pots: PotAnim[];
  /** Прицел для показа (свой или чужой), null — не рисовать. */
  aim: AimState | null;
  aimAlpha: number;
  kitchen: { valid: boolean } | null;
  invalidCue: boolean;
}

/** Один кадр: стол из кэша, тени, прицел, шары, проваливающиеся шары, кий. */
export function drawScene(i: SceneInput): void {
  const { g, view, now } = i;
  g.setTransform(i.dpr, 0, 0, i.dpr, 0, 0);
  g.clearRect(0, 0, view.w, view.h);
  if (i.cache) g.drawImage(i.cache, 0, 0, view.w, view.h);
  if (i.kitchen) drawKitchen(g, view, now, i.kitchen.valid);

  const cue = i.balls.find((b) => b.id === 0);
  if (i.aim && cue) drawAimLine(g, view, i.balls, cue, i.aim, i.aimAlpha);

  const falling = i.pots.map((p) => {
    const e = Math.min(1, (now - p.t0) / POT_MS);
    return {
      b: { ...p.ball, x: p.ball.x + (p.px - p.ball.x) * e, y: p.ball.y + (p.py - p.ball.y) * e },
      fx: { scale: 1 - 0.8 * e, dark: 0.7 * e },
    };
  });
  for (const f of falling) drawBallShadow(g, view, f.b, f.fx);
  for (const b of i.balls) drawBallShadow(g, view, b);
  for (const f of falling) drawBall(g, view, f.b, i.orient, f.fx);
  for (const b of i.balls) drawBall(g, view, b, i.orient);
  if (i.invalidCue && cue) drawInvalidCue(g, view, cue);
  if (i.aim && cue) drawCue(g, view, cue, i.aim, i.aimAlpha);
}
