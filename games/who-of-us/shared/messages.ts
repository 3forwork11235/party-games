/** Игровые сообщения клиент → сервер (префикс — slug игры). */
export interface GameClientMessages {
  'who-of-us:packs': { packIds: string[] };
  'who-of-us:vote': { target: string; guess: string };
  'who-of-us:skip': Record<string, never>;
}

export const MSG_PACKS = 'who-of-us:packs';
export const MSG_VOTE = 'who-of-us:vote';
export const MSG_SKIP = 'who-of-us:skip';
