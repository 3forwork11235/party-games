import type { BallKind } from './types.js';

/** Игровое поле по носам бортов, м. Начало — левый нижний угол, y вверх. */
export const L = 2.54;
export const W = 1.27;
/** Створ угловой лузы (по диагонали между губками) и средней. */
export const CM = 0.118;
export const SM = 0.128;
/** Отступ начала борта от угла по каждой оси: CM/√2. */
export const CORNER_C = CM / Math.SQRT2;

/** Лузы: 4 угловые + 2 средние (индексы 0..5). */
export const POCKETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: L, y: 0 },
  { x: 0, y: W },
  { x: L, y: W },
  { x: L / 2, y: 0 },
  { x: L / 2, y: W },
];

export interface Cushion {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

const MID_A = L / 2 - SM / 2;
const MID_B = L / 2 + SM / 2;

/** Борта — 6 отрезков по носам. Концы отрезков — «губки». */
export const CUSHIONS: readonly Cushion[] = [
  { ax: CORNER_C, ay: 0, bx: MID_A, by: 0 },
  { ax: MID_B, ay: 0, bx: L - CORNER_C, by: 0 },
  { ax: CORNER_C, ay: W, bx: MID_A, by: W },
  { ax: MID_B, ay: W, bx: L - CORNER_C, by: W },
  { ax: 0, ay: CORNER_C, bx: 0, by: W - CORNER_C },
  { ax: L, ay: CORNER_C, bx: L, by: W - CORNER_C },
];

/** Дом (kitchen): x ≤ L/4. */
export const KITCHEN_X = L / 4;
export const HEAD_SPOT = { x: L / 4, y: W / 2 };
export const FOOT_SPOT = { x: (3 * L) / 4, y: W / 2 };

export interface BallSpec {
  r: number;
  value: number;
}

export const BALL_SPECS: Readonly<Record<BallKind, BallSpec>> = {
  cue: { r: 0.0286, value: 0 },
  small: { r: 0.022, value: 1 },
  std: { r: 0.0286, value: 2 },
  big: { r: 0.035, value: 3 },
  giant: { r: 0.042, value: 5 },
  gold: { r: 0.0286, value: 8 },
};

const R_REF = 0.0286;

/** Масса m = 0.17·(r/0.0286)³ кг. */
export function massOf(r: number): number {
  const q = r / R_REF;
  return 0.17 * (q * q * q);
}

/** Центр внутри прямоугольника [0,L]×[0,W]. */
export function isInsideTable(x: number, y: number): boolean {
  return x >= 0 && x <= L && y >= 0 && y <= W;
}
