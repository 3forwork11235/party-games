import { MAX_TIP_OFFSET } from '../shared/physics/index.js';
import { isValidCuePlacement } from '../shared/rack.js';
import { BALL_SPECS, KITCHEN_X, W } from '../shared/table.js';
import type { AimMessage, ShotMessage } from '../shared/messages.js';

export interface ParsedShot {
  dx: number;
  dy: number;
  power: number;
  spinX: number;
  spinY: number;
  cueX?: number;
  cueY?: number;
}

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Нормирует направление; null — вектор нулевой/некорректный. */
function unit(dx: unknown, dy: unknown): { dx: number; dy: number } | null {
  if (!fin(dx) || !fin(dy)) return null;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!(len > 1e-6)) return null;
  return { dx: dx / len, dy: dy / len };
}

/** Валидация и нормализация удара (SPEC §7). Положение битка проверяет вызывающий. */
export function parseShot(raw: unknown): ParsedShot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Partial<ShotMessage>;
  const d = unit(m.dx, m.dy);
  if (!d || !fin(m.power) || !fin(m.spinX) || !fin(m.spinY)) return null;
  const power = m.power < 0 ? 0 : m.power > 1 ? 1 : m.power;
  let a = m.spinX;
  let b = m.spinY;
  const sl = Math.sqrt(a * a + b * b);
  if (sl > MAX_TIP_OFFSET) {
    a = (a / sl) * MAX_TIP_OFFSET;
    b = (b / sl) * MAX_TIP_OFFSET;
  }
  const out: ParsedShot = { dx: d.dx, dy: d.dy, power, spinX: a, spinY: b };
  if (fin(m.cueX) && fin(m.cueY)) {
    out.cueX = m.cueX;
    out.cueY = m.cueY;
  }
  return out;
}

export function parseAim(raw: unknown): AimMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Partial<AimMessage>;
  const d = unit(m.dx, m.dy);
  if (!d || !fin(m.power)) return null;
  const out: AimMessage = {
    dx: d.dx,
    dy: d.dy,
    power: m.power < 0 ? 0 : m.power > 1 ? 1 : m.power,
  };
  if (fin(m.cueX) && fin(m.cueY)) {
    out.cueX = m.cueX;
    out.cueY = m.cueY;
  }
  return out;
}

/** Свободное место для битка в доме: HEAD_SPOT, иначе сдвиг влево (и по y), пока не найдётся. */
export function findFreeCueSpot(
  balls: ReadonlyArray<{ id: number; x: number; y: number; r: number; potted?: boolean }>,
  head: { x: number; y: number },
): { x: number; y: number } {
  const r = BALL_SPECS.cue.r;
  const step = r / 2;
  for (let x = head.x; x >= r; x -= step) {
    for (let k = 0; k < 12; k++) {
      const off = Math.ceil(k / 2) * step * 2 * (k % 2 === 1 ? 1 : -1);
      const y = head.y + off;
      if (y >= r && y <= W - r && x <= KITCHEN_X && isValidCuePlacement(x, y, balls)) {
        return { x, y };
      }
    }
  }
  return { x: head.x, y: head.y };
}
