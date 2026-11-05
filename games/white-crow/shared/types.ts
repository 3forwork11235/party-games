import type { ICoreState } from '@party/core/shared';

/** Публичный вид состояния для клиента (без зависимости от серверного Schema-класса). */
export interface CrowPublicState extends ICoreState {
  packs: string[];
  rounds: number;
  rules: string[];
  questionId: string;
  options: number[];
  picked: string[];
  peekers: string[];
  picks: Map<string, number>;
  lone: Map<string, number>;
  matches: Map<string, number>;
}
