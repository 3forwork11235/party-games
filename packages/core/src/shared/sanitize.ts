import { maskProfanity } from './profanity.js';
import { graphemes, stripControl } from './strip.js';

export const NICK_MAX_GRAPHEMES = 16;
export const CHAT_MAX_LENGTH = 200;

export function sanitizeNick(raw: unknown, fallbackIndex: number): string {
  const text = typeof raw === 'string' ? stripControl(raw).replace(/\s+/g, ' ').trim() : '';
  const nick = graphemes(text).slice(0, NICK_MAX_GRAPHEMES).join('').trim();
  return nick === '' ? `Player ${fallbackIndex}` : nick;
}

export function sanitizeChat(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = stripControl(raw).trim();
  if (text === '') return null;
  return maskProfanity(Array.from(text).slice(0, CHAT_MAX_LENGTH).join(''));
}
