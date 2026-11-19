import { BALL_SPECS, FOOT_SPOT, HEAD_SPOT, KITCHEN_X, W } from './table.js';
import type { BallKind } from './types.js';

export interface RackBall {
  id: number;
  kind: BallKind;
  x: number;
  y: number;
  r: number;
  value: number;
}

/** Состав прицельных шаров: id 1..10 закреплены за видом. */
const TARGET_KINDS: readonly BallKind[] = [
  'small',
  'small',
  'small',
  'std',
  'std',
  'std',
  'big',
  'big',
  'giant',
  'gold',
];

const GAP = 0.002;
const D = 2 * BALL_SPECS.giant.r + GAP;
const ROW_STEP = (D * Math.sqrt(3)) / 2;
/** Индекс слота центра 3-го ряда (ряды: 1+2+3+4). */
const GOLD_SLOT = 4;

function slots(): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < 4; row++) {
    for (let j = 0; j <= row; j++) {
      out.push({ x: FOOT_SPOT.x + row * ROW_STEP, y: FOOT_SPOT.y + (j - row / 2) * D });
    }
  }
  return out;
}

/** Биток (id 0) в HEAD_SPOT + 10 прицельных; gold всегда в центре 3-го ряда, остальные перемешаны. */
export function createRack(rng: () => number): RackBall[] {
  const cue = BALL_SPECS.cue;
  const balls: RackBall[] = [
    { id: 0, kind: 'cue', x: HEAD_SPOT.x, y: HEAD_SPOT.y, r: cue.r, value: cue.value },
  ];
  const sl = slots();
  const ids: number[] = [];
  for (let id = 1; id <= 10; id++) if (TARGET_KINDS[id - 1] !== 'gold') ids.push(id);
  for (let i = ids.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    const tmp = ids[i] as number;
    ids[i] = ids[k] as number;
    ids[k] = tmp;
  }
  const slotIdx: number[] = [];
  for (let s = 0; s < sl.length; s++) if (s !== GOLD_SLOT) slotIdx.push(s);
  const place = (id: number, slot: number): void => {
    const kind = TARGET_KINDS[id - 1] as BallKind;
    const spec = BALL_SPECS[kind];
    const p = sl[slot] as { x: number; y: number };
    balls.push({ id, kind, x: p.x, y: p.y, r: spec.r, value: spec.value });
  };
  place(10, GOLD_SLOT);
  for (let i = 0; i < ids.length; i++) place(ids[i] as number, slotIdx[i] as number);
  balls.sort((a, b) => a.id - b.id);
  return balls;
}

/** Биток «с руки»: в доме, с отступом r от бортов, без перекрытий с другими шарами. */
export function isValidCuePlacement(
  x: number,
  y: number,
  balls: ReadonlyArray<{ id: number; x: number; y: number; r: number; potted?: boolean }>,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = BALL_SPECS.cue.r;
  if (x > KITCHEN_X || x < r || y < r || y > W - r) return false;
  for (const b of balls) {
    if (b.id === 0 || b.potted === true) continue;
    const dx = b.x - x;
    const dy = b.y - y;
    const s = r + b.r;
    if (dx * dx + dy * dy < s * s) return false;
  }
  return true;
}
