/** Игровые сообщения клиент → сервер (префикс — slug игры). */
export interface GameClientMessages {
  'spy:settings': { packIds: string[]; rounds: number };
  'spy:hello': Record<string, never>;
  'spy:seen': Record<string, never>;
  'spy:ask': { targetId: string };
  'spy:answered': Record<string, never>;
  'spy:pass': Record<string, never>;
  'spy:callVote': { on: boolean };
  'spy:vote': { targetId: string };
  'spy:guess': { locationId: string };
  'spy:hint': Record<string, never>;
}

export const MSG_SETTINGS = 'spy:settings';
export const MSG_HELLO = 'spy:hello';
export const MSG_SEEN = 'spy:seen';
export const MSG_ASK = 'spy:ask';
export const MSG_ANSWERED = 'spy:answered';
export const MSG_PASS = 'spy:pass';
export const MSG_CALL_VOTE = 'spy:callVote';
export const MSG_VOTE = 'spy:vote';
export const MSG_GUESS = 'spy:guess';
export const MSG_HINT = 'spy:hint';

/** Сервер → клиент (адресно): своя роль раунда. */
export const MSG_ROLE = 'spy:role';

export interface SpyRoleMessage {
  round: number;
  spy: boolean;
  /** Только не-шпиону. */
  locationId?: string;
  /** Только не-шпиону: индекс роли 0..6 в записи локации. */
  roleIndex?: number;
  /** Зачёркнутые подсказками неверные локации (только у шпиона не пусто). */
  crossed: string[];
  hintsLeft: number;
}
