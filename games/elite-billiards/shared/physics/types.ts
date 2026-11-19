// КОНТРАКТ физики (архитектор). Единицы: метры, секунды, кг. Оси: x вправо, y ВВЕРХ, z вверх
// (правая тройка; клиент при рендере переворачивает y). Только +,-,*,/ и Math.sqrt —
// никаких Math.sin/cos/exp/hypot/pow в симуляции, чтобы сервер и клиент считали бит-в-бит.

/** Динамическое состояние шара в симуляции. */
export interface SimBall {
  id: number;
  r: number;
  /** Масса ∝ r³ (одинаковая плотность). */
  m: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Угловая скорость, рад/с (wz — боковое вращение, «винт»). */
  wx: number;
  wy: number;
  wz: number;
  potted: boolean;
  /** Шар неподвижен (все скорости обнулены). */
  resting: boolean;
}

export interface ShotInput {
  /** Шары на столе; id 0 — биток. Позиции уже валидны (без перекрытий). */
  balls: ReadonlyArray<{ id: number; x: number; y: number; r: number }>;
  /** Единичный вектор направления. */
  dx: number;
  dy: number;
  /** 0..1. */
  power: number;
  /** Смещение точки удара в долях радиуса, |(spinX, spinY)| ≤ MAX_TIP_OFFSET. */
  spinX: number;
  spinY: number;
}

export type SimEvent =
  | { type: 'ball'; step: number; a: number; b: number; impulse: number }
  | { type: 'cushion'; step: number; ball: number; impulse: number }
  | { type: 'pot'; step: number; ball: number; pocket: number };

export interface ShotResult {
  /** Финальные позиции не забитых шаров (округлены roundPos). */
  final: Array<{ id: number; x: number; y: number }>;
  /** id забитых шаров в порядке падения. */
  potted: number[];
  /** id первого прицельного шара, которого коснулся биток; -1 — ни одного. */
  firstHit: number;
  steps: number;
  durationMs: number;
}

/** Пошаговая симуляция (клиент двигает её в реальном времени). */
export interface Simulation {
  readonly balls: readonly SimBall[];
  readonly step: number;
  readonly done: boolean;
  /** Сделать один шаг DT; вернуть события этого шага. */
  advance(): SimEvent[];
}
