import { BOT_AIM_NOISE_DEG, BOT_MAX_SIMS, BOT_POWER_NOISE } from './config.js';
import { findCandidates, safeDirection, type BotBall, type Candidate } from './botAim.js';
import type { ShotMessage } from './messages.js';
import { simulateShot } from './physics/index.js';
import { isValidCuePlacement } from './rack.js';
import { resolveShot } from './rules.js';
import { BALL_SPECS, KITCHEN_X, L, W } from './table.js';

export type { BotBall } from './botAim.js';

export interface BotOptions {
  /** Множитель человеческой ошибки: 1 — по умолчанию, 0 — идеальное исполнение. */
  noise?: number;
}

const SAFE_POWER = 0.4;
const BREAK_POWER = 0.92;
const TOP_CANDIDATES = 6;
const GRID_X = 4;
const GRID_Y = 4;
const R_CUE = BALL_SPECS.cue.r;

interface Planned {
  dx: number;
  dy: number;
  power: number;
  spinY: number;
}

/** Оценка удара настоящей физикой: очки по resolveShot + небольшой бонус за биток не у борта. */
function evaluate(
  balls: readonly BotBall[],
  cx: number,
  cy: number,
  c: Candidate,
  power: number,
  values: ReadonlyMap<number, number>,
): number {
  const sim = balls.map((b) => ({
    id: b.id,
    x: b.id === 0 ? cx : b.x,
    y: b.id === 0 ? cy : b.y,
    r: b.r,
  }));
  const result = simulateShot({ balls: sim, dx: c.dx, dy: c.dy, power, spinX: 0, spinY: 0 });
  const res = resolveShot({ result, values, cueInHand: false });
  if (res.points <= 0) return res.points;
  const cue = result.final.find((f) => f.id === 0);
  const edge = cue ? Math.min(cue.x, cue.y, L - cue.x, W - cue.y) : 0;
  return res.points + (edge > 0.08 ? 0.5 : 0) - 0.1 * power;
}

function plan(balls: readonly BotBall[], cx: number, cy: number): { shot: Planned; score: number } {
  const values = new Map<number, number>();
  for (const b of balls) if (b.id > 0) values.set(b.id, b.value);
  const cands = findCandidates(balls, cx, cy, R_CUE).slice(0, TOP_CANDIDATES);
  let best: Planned | null = null;
  let bestScore = 0;
  let sims = 0;
  for (const c of cands) {
    for (const power of [c.power, Math.min(1, c.power * 1.35)]) {
      if (sims >= BOT_MAX_SIMS) break;
      sims += 1;
      const score = evaluate(balls, cx, cy, c, power, values);
      if (score > bestScore) {
        bestScore = score;
        best = { dx: c.dx, dy: c.dy, power, spinY: 0 };
      }
      if (power >= 1) break;
    }
  }
  if (best) return { shot: best, score: bestScore };
  const dir = safeDirection(balls, cx, cy, R_CUE);
  const power = isPacked(balls) ? BREAK_POWER : SAFE_POWER;
  return { shot: { dx: dir.dx, dy: dir.dy, power, spinY: 0 }, score: 0 };
}

/** Плотная пирамида (разбой): ≥ 7 прицельных шаров в радиусе 0.3 м от их центра. */
function isPacked(balls: readonly BotBall[]): boolean {
  const obj = balls.filter((b) => b.id > 0);
  if (obj.length < 7) return false;
  const mx = obj.reduce((a, b) => a + b.x, 0) / obj.length;
  const my = obj.reduce((a, b) => a + b.y, 0) / obj.length;
  const near = obj.filter((b) => (b.x - mx) ** 2 + (b.y - my) ** 2 < 0.09).length;
  return near >= 7;
}

/** Точки сетки в доме. */
function kitchenGrid(): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < GRID_X; i++) {
    for (let j = 0; j < GRID_Y; j++) {
      const x = R_CUE + ((KITCHEN_X - R_CUE) * i) / (GRID_X - 1);
      const y = R_CUE + ((W - 2 * R_CUE) * j) / (GRID_Y - 1);
      out.push({ x, y });
    }
  }
  return out;
}

/** Лучшая точка постановки битка с руки по геометрической оценке. */
function bestPlacement(balls: readonly BotBall[]): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  let bestGeo = -1;
  for (const p of kitchenGrid()) {
    if (!isValidCuePlacement(p.x, p.y, balls)) continue;
    const cands = findCandidates(balls, p.x, p.y, R_CUE);
    const geo = cands.length > 0 ? (cands[0] as Candidate).geo : 0;
    if (geo > bestGeo) {
      bestGeo = geo;
      best = p;
    }
  }
  return best ?? { x: KITCHEN_X, y: W / 2 };
}

/**
 * Удар бота: «шар-призрак» → лузы, проверка настоящей физикой, человеческая ошибка.
 * `balls` — все шары на столе (биток id 0 + прицельные id > 0).
 */
export function planBotShot(
  balls: readonly BotBall[],
  cueInHand: boolean,
  rng: () => number,
  opts: BotOptions = {},
): ShotMessage {
  const noise = opts.noise ?? 1;
  const cue = balls.find((b) => b.id === 0);
  let cx = cue ? cue.x : KITCHEN_X;
  let cy = cue ? cue.y : W / 2;
  if (cueInHand) {
    const p = bestPlacement(balls);
    cx = p.x;
    cy = p.y;
  }
  const { shot } = plan(balls, cx, cy);
  const ang = (rng() + rng() - 1) * BOT_AIM_NOISE_DEG * noise * (Math.PI / 180);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const power = Math.min(
    1,
    Math.max(0, shot.power * (1 + (rng() * 2 - 1) * BOT_POWER_NOISE * noise)),
  );
  const msg: ShotMessage = {
    dx: shot.dx * cos - shot.dy * sin,
    dy: shot.dx * sin + shot.dy * cos,
    power,
    spinX: 0,
    spinY: shot.spinY,
  };
  if (cueInHand) {
    msg.cueX = cx;
    msg.cueY = cy;
  }
  return msg;
}
