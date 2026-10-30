import type { Outcome } from '../shared/scoring.js';

export interface RoundResult {
  outcome: Outcome;
  accused: string;
  guess: string;
}

/** Скрытые данные раунда: в публичное состояние попадают только в onRoundEnd. */
export class RoundSecret {
  spy = '';
  locationId = '';
  /** playerId → индекс роли 0..6 (у шпиона записи нет). */
  readonly roles = new Map<string, number>();
  crossed: string[] = [];
  hintsUsed = 0;
  /** voter → target. */
  readonly ballots = new Map<string, string>();
  guessUsed = false;
  /** Обвинённый по итогам голосования ('' — никто). */
  accused = '';
  result: RoundResult | null = null;
}
