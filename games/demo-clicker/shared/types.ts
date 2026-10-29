import type { ICoreState } from '@party/core/shared';

/** Публичный вид состояния для клиента (без серверного Schema-класса). */
export interface ClickerPublicState extends ICoreState {
  target: number;
  clicks: Map<string, number>;
  finishOrder: string[];
}
