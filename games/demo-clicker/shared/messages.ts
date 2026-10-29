/** Игровые сообщения клиент → сервер. */
export const MSG_TAP = 'demo-clicker:tap';

export interface GameClientMessages {
  [MSG_TAP]: Record<string, never>;
}
