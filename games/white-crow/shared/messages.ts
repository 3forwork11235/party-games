/** Игровые сообщения клиент → сервер (префикс — slug игры). */
export interface GameClientMessages {
  'white-crow:settings': { packIds: string[]; rounds: number };
  'white-crow:hello': Record<string, never>;
  'white-crow:pick': { option: number };
  'white-crow:peek': Record<string, never>;
}

export const MSG_SETTINGS = 'white-crow:settings';
export const MSG_HELLO = 'white-crow:hello';
export const MSG_PICK = 'white-crow:pick';
export const MSG_PEEK = 'white-crow:peek';
/** Сервер → клиент (адресно). */
export const MSG_YOU = 'white-crow:you';

/** option = −1, если ещё не выбрал; peek — числа выборов по options (или []). */
export interface YouMessage {
  round: number;
  option: number;
  peek: number[];
}
