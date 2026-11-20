import { L, W } from '../shared/table.js';

/** Ширина деревянного борта вокруг игрового поля, м. */
export const RAIL = 0.12;

export interface Pt {
  x: number;
  y: number;
}

/** Раскладка стола на экране: масштаб, поворот и преобразования table (x вправо, y вверх) ↔ screen. */
export interface View {
  /** Размер холста в CSS-пикселях. */
  w: number;
  h: number;
  /** px на метр. */
  scale: number;
  /** Стол повёрнут на 90° (портрет). */
  rotated: boolean;
  /** Матрица table(м) → screen(css px) для ctx.setTransform (без dpr). */
  matrix: [number, number, number, number, number, number];
  toScreen(x: number, y: number): Pt;
  toTable(px: number, py: number): Pt;
  /** Единичный вектор стола → единичный вектор экрана. */
  vec(dx: number, dy: number): Pt;
}

/** top/bottom — высота HUD и панели управления поверх холста: стол всегда вписывается между ними. */
export function createView(w: number, h: number, top = 0, bottom = 0): View {
  const rotated = h > w;
  const tw = L + 2 * RAIL;
  const th = W + 2 * RAIL;
  const sw = rotated ? th : tw;
  const sh = rotated ? tw : th;
  const free = Math.max(1, h - top - bottom);
  const scale = Math.max(1, Math.min(w / sw, free / sh));
  const ox = (w - sw * scale) / 2;
  const oy = top + (free - sh * scale) / 2;
  const s = scale;
  const matrix: View['matrix'] = rotated
    ? [0, s, s, 0, ox + s * RAIL, oy + s * RAIL]
    : [s, 0, 0, -s, ox + s * RAIL, oy + s * (W + RAIL)];
  return {
    w,
    h,
    scale,
    rotated,
    matrix,
    toScreen(x, y) {
      return rotated
        ? { x: ox + (y + RAIL) * s, y: oy + (x + RAIL) * s }
        : { x: ox + (x + RAIL) * s, y: oy + (W + RAIL - y) * s };
    },
    toTable(px, py) {
      return rotated
        ? { x: (py - oy) / s - RAIL, y: (px - ox) / s - RAIL }
        : { x: (px - ox) / s - RAIL, y: W + RAIL - (py - oy) / s };
    },
    vec(dx, dy) {
      return rotated ? { x: dy, y: dx } : { x: dx, y: -dy };
    },
  };
}
