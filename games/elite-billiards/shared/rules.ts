import { PENALTY_NO_HIT, PENALTY_SCRATCH, PENALTY_TIMEOUT } from './config.js';
import type { ShotResult } from './physics/types.js';
import type { FoulKind } from './types.js';

export interface ResolveInput {
  result: Pick<ShotResult, 'potted' | 'firstHit'>;
  /** Номиналы прицельных шаров: id → value. */
  values: ReadonlyMap<number, number>;
  /** Удар сделан битком «с руки». */
  cueInHand: boolean;
}

export interface Resolution {
  points: number;
  foul: FoulKind;
  /** Стрелок бьёт снова. */
  keepTurn: boolean;
  /** Следующий стрелок ставит биток с руки. */
  cueInHandNext: boolean;
}

/** Итог удара по SPEC §6. */
export function resolveShot(input: ResolveInput): Resolution {
  const { result, values } = input;
  if (result.potted.includes(0)) {
    return { points: -PENALTY_SCRATCH, foul: 'scratch', keepTurn: false, cueInHandNext: true };
  }
  if (result.firstHit < 0) {
    return { points: -PENALTY_NO_HIT, foul: 'noHit', keepTurn: false, cueInHandNext: false };
  }
  let points = 0;
  for (const id of result.potted) if (id > 0) points += values.get(id) ?? 0;
  return { points, foul: '', keepTurn: points > 0, cueInHandNext: false };
}

/** Таймаут удара: штраф, ход следующему, cueInHand сохраняется. */
export function resolveTimeout(cueInHand: boolean): Resolution {
  return { points: -PENALTY_TIMEOUT, foul: 'timeout', keepTurn: false, cueInHandNext: cueInHand };
}

/** Следующий подключённый игрок после current (по кругу; сам current — последним). '' если никого. */
export function nextShooter(
  order: readonly string[],
  current: string,
  isConnected: (id: string) => boolean,
): string {
  const n = order.length;
  if (n === 0) return '';
  const start = order.indexOf(current);
  for (let i = 1; i <= n; i++) {
    const id = order[(start + i + n) % n] as string;
    if (isConnected(id)) return id;
  }
  return '';
}

/** Первый стрелок раунда r (с 1): order[(r-1) % n], пропуская отключённых. */
export function firstShooter(
  order: readonly string[],
  round: number,
  isConnected: (id: string) => boolean,
): string {
  const n = order.length;
  if (n === 0) return '';
  const id = order[(((round - 1) % n) + n) % n] as string;
  return isConnected(id) ? id : nextShooter(order, id, isConnected);
}

/** Очки раунда: отрицательные → 0. */
export function clampRackScore(score: number): number {
  return score > 0 ? score : 0;
}
