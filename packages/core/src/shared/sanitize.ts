export const NICK_MAX_GRAPHEMES = 16;
export const CHAT_MAX_LENGTH = 200;

// Невидимые/управляющие форматирующие символы (ZWJ U+200D оставляем ради составных эмодзи).
const INVISIBLE = new RegExp(
  '[\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u00AD]',
  'g',
);
const CONTROL = /\p{Cc}/gu;

function stripControl(s: string): string {
  return s.replace(CONTROL, (c) => (/\s/.test(c) ? ' ' : '')).replace(INVISIBLE, '');
}

function graphemes(s: string): string[] {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Seg) return Array.from(s);
  return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
}

export function sanitizeNick(raw: unknown, fallbackIndex: number): string {
  const text = typeof raw === 'string' ? stripControl(raw).replace(/\s+/g, ' ').trim() : '';
  const nick = graphemes(text).slice(0, NICK_MAX_GRAPHEMES).join('').trim();
  return nick === '' ? `Player ${fallbackIndex}` : nick;
}

export function sanitizeChat(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = stripControl(raw).trim();
  if (text === '') return null;
  return Array.from(text).slice(0, CHAT_MAX_LENGTH).join('');
}
