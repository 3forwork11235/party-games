import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './contracts.js';

/** Генерирует код комнаты из ROOM_CODE_ALPHABET. rng возвращает число в [0, 1). */
export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.min(
      ROOM_CODE_ALPHABET.length - 1,
      Math.floor(rng() * ROOM_CODE_ALPHABET.length),
    );
    code += ROOM_CODE_ALPHABET.charAt(idx);
  }
  return code;
}

/** Приводит ввод к коду комнаты или возвращает null, если ввод некорректен. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]+/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  }
  return code;
}
