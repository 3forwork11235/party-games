import type { ICoreState } from '@party/core/shared';

/** Публичный вид состояния для клиента (без зависимости от серверного Schema-класса). */
export interface WhoOfUsPublicState extends ICoreState {
  packs: string[];
  questionId: string;
  voted: string[];
  tally: Map<string, number>;
  leaders: string[];
  correct: string[];
  leaderCount: Map<string, number>;
  skipsLeft: number;
}
