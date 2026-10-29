import { normalizeRoomCode } from '../shared/roomCode.js';

/** Читает код комнаты из `?room=CODE`. Возвращает null, если параметра нет или код некорректен. */
export function readRoomCodeFromUrl(search: string): string | null {
  const raw = new URLSearchParams(search).get('room');
  return raw ? normalizeRoomCode(raw) : null;
}
