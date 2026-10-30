import type { ICoreState } from '@party/core/shared';

export type Stage = 'write' | 'vote' | '';

export interface PublicOption {
  id: string;
  text: string;
}

/** Публичный вид состояния для клиента (без зависимости от серверного Schema-класса). */
export interface BluffPublicState extends ICoreState {
  packs: string[];
  rounds: number;
  lang: string;
  stage: Stage;
  questionId: string;
  category: string;
  question: string;
  submitted: string[];
  voted: string[];
  options: PublicOption[];
  /** Раскрытие — только в roundEnd, иначе ''/пусто. */
  truthId: string;
  lies: Map<string, string>;
  votes: Map<string, string>;
}
