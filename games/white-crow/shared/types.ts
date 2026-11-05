import type { ICoreState } from '@party/core/shared';

/** Публичный вид состояния для клиента (без зависимости от серверного Schema-класса). */
export interface WhiteCrowPublicState extends ICoreState {
  taps: number;
}
