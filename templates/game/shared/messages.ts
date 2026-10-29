/** Игровые сообщения клиент → сервер (префикс — slug игры). */
export interface GameClientMessages {
  '__SLUG__:tap': { x: number; y: number };
}

export const MSG_TAP = '__SLUG__:tap';
