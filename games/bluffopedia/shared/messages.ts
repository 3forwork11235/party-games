/** Игровые сообщения клиент → сервер (префикс — slug игры). */
export interface GameClientMessages {
  'bluffopedia:settings': { packIds: string[]; rounds: number; lang: string };
  'bluffopedia:hello': Record<string, never>;
  'bluffopedia:lie': { text: string };
  'bluffopedia:vote': { optionId: string };
  'bluffopedia:hint': Record<string, never>;
}

export const MSG_SETTINGS = 'bluffopedia:settings';
export const MSG_HELLO = 'bluffopedia:hello';
export const MSG_LIE = 'bluffopedia:lie';
export const MSG_VOTE = 'bluffopedia:vote';
export const MSG_HINT = 'bluffopedia:hint';

/** Сервер → клиент (адресно): своя выдумка, свой вариант и подсказка раунда. */
export const MSG_YOU = 'bluffopedia:you';

export interface YouMessage {
  round: number;
  /** Моя принятая выдумка ('' — нет). */
  lie: string;
  /** Id моего варианта (с vote; '' — нет). */
  ownId: string;
  /** Id убранного подсказкой варианта ('' — подсказка не использована). */
  hintId: string;
}
