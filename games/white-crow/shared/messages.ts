/** Игровые сообщения клиент → сервер (префикс — slug игры). */
export interface GameClientMessages {
  'white-crow:tap': { x: number; y: number };
}

export const MSG_TAP = 'white-crow:tap';
