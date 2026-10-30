import type { ICoreState } from '@party/core/shared';

export type Stage = 'roles' | 'discussion' | 'voting' | 'lastChance' | '';

/** Публичный вид состояния для клиента (без зависимости от серверного Schema-класса). */
export interface SpyPublicState extends ICoreState {
  packs: string[];
  rounds: number;
  stage: Stage;
  board: string[];
  askerId: string;
  targetId: string;
  lastAskerId: string;
  questions: number;
  seen: string[];
  voteCalls: string[];
  voted: string[];
  /** Раскрытие — только в roundEnd, иначе ''. */
  spyId: string;
  locationId: string;
  accusedId: string;
  guessId: string;
  outcome: string;
  votes: Map<string, string>;
}
