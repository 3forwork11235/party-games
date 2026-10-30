import { graphemes, stripControl } from './strip.js';

export { maskProfanity } from './profanity.js';

/** Ответ/выдумка игрока: без управляющих символов, пробелы схлопнуты, обрезка по графемам. */
export function sanitizeAnswer(raw: unknown, maxGraphemes: number): string | null {
  if (typeof raw !== 'string') return null;
  const text = stripControl(raw).replace(/\s+/g, ' ').trim();
  if (text === '') return null;
  const cut = graphemes(text).slice(0, Math.max(0, maxGraphemes)).join('').trim();
  return cut === '' ? null : cut;
}

/** Ключ для сравнения ответов: NFKC, нижний регистр, ё→е, без пунктуации/символов. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
