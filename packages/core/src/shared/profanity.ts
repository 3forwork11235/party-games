// Корни явной брани. Слово маскируется, если начинается с корня (после ё→е, lower-case).
// Короткие/опасные корни — в EXACT (только слово целиком).
const PREFIX_ROOTS = [
  // ru
  'хуй',
  'хуе',
  'хуи',
  'хуя',
  'пизд',
  'ебат',
  'ебал',
  'ебан',
  'ебну',
  'ебат',
  'заеб',
  'уеб',
  'выеб',
  'мудак',
  'мудил',
  'пидор',
  'пидар',
  'пидр',
  'гандон',
  'блядь',
  'бляд',
  'блять',
  'сука',
  'суки',
  'залуп',
  'долбоеб',
  'ебло',
  // kk
  'сікт',
  'сиктир',
  'жалбағай',
  'амын',
  'қотақ',
  'котак',
  // en
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'dickhead',
  'bastard',
  'motherfuck',
  'whore',
  'slut',
  'nigger',
  'faggot',
];
const EXACT = ['хер', 'хуй', 'ебу', 'ебись', 'пох', 'dick', 'cock', 'tits', 'piss', 'wank'];

const norm = (w: string): string => w.toLowerCase().replace(/ё/g, 'е');
const PREFIXES = PREFIX_ROOTS.map(norm);
const EXACT_SET = new Set(EXACT.map(norm));

function isBad(word: string): boolean {
  const w = norm(word);
  return EXACT_SET.has(w) || PREFIXES.some((r) => w.startsWith(r));
}

/** Заменяет грубые слова на `***` (слово целиком). */
export function maskProfanity(s: string): string {
  return s.replace(/[\p{L}\p{M}]+/gu, (w) => (isBad(w) ? '***' : w));
}
