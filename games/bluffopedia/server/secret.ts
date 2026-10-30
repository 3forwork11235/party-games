import type { Option } from '../shared/logic.js';
import type { BankQuestion } from './bank.js';

/** Скрытые данные раунда: в публичное состояние попадают только в onRoundEnd (и варианты в vote). */
export class RoundSecret {
  record: BankQuestion | null = null;
  /** автор → принятая выдумка. */
  readonly lies = new Map<string, string>();
  options: Option[] = [];
  /** голосующий → id варианта. */
  readonly votes = new Map<string, string>();
  /** игрок → id убранного подсказкой варианта. */
  readonly hints = new Map<string, string>();
  /** Игроки, уже использовавшие подсказку в раунде. */
  readonly hintUsed = new Set<string>();
}
