import { normalizeAnswer } from '@party/core/shared';
import { MIN_OPTIONS } from './config.js';
import { questionIds, type PackId } from './packs.js';

export type Rnd = () => number;

export interface Option {
  id: string;
  text: string;
  kind: 'truth' | 'lie' | 'house';
  authors: string[];
}

/** Случайный вопрос без повторов в партии; если все использованы — из всех выбранных. */
export function pickQuestion(
  packs: readonly PackId[],
  used: ReadonlySet<string>,
  rnd: Rnd = Math.random,
): string {
  const all = questionIds(packs);
  const fresh = all.filter((id) => !used.has(id));
  const pool = fresh.length > 0 ? fresh : all;
  return pool[Math.floor(rnd() * pool.length)] ?? '';
}

export function shuffle<T>(items: readonly T[], rnd: Rnd = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Совпадает ли текст с правильным ответом или его допустимыми написаниями. */
export function isTruth(text: string, truth: string, alt: readonly string[]): boolean {
  const n = normalizeAnswer(text);
  return n === normalizeAnswer(truth) || alt.some((a) => normalizeAnswer(a) === n);
}

export interface OptionsInput {
  truth: string;
  alt: readonly string[];
  fakes: readonly string[];
  /** автор → текст выдумки. */
  lies: ReadonlyMap<string, string>;
}

/**
 * Варианты голосования: правда + уникальные выдумки (слияние по normalizeAnswer, текст — первого
 * автора), при нехватке (< MIN_OPTIONS) — «выдумки игры» из fakes. Перемешаны, id o1..oN.
 */
export function buildOptions(input: OptionsInput, rnd: Rnd = Math.random): Option[] {
  const { truth, alt, fakes, lies } = input;
  const seen = new Set<string>([normalizeAnswer(truth), ...alt.map(normalizeAnswer)]);
  const items: Omit<Option, 'id'>[] = [{ text: truth, kind: 'truth', authors: [] }];
  const byNorm = new Map<string, Omit<Option, 'id'>>();
  for (const [author, text] of lies) {
    const n = normalizeAnswer(text);
    if (n === '' || isTruth(text, truth, alt)) continue;
    const existing = byNorm.get(n);
    if (existing) {
      if (!existing.authors.includes(author)) existing.authors.push(author);
      continue;
    }
    const item = { text, kind: 'lie' as const, authors: [author] };
    byNorm.set(n, item);
    seen.add(n);
    items.push(item);
  }
  for (const fake of fakes) {
    if (items.length >= MIN_OPTIONS) break;
    const n = normalizeAnswer(fake);
    if (n === '' || seen.has(n)) continue;
    seen.add(n);
    items.push({ text: fake, kind: 'house', authors: [] });
  }
  return shuffle(items, rnd).map((o, i) => ({ ...o, id: `o${i + 1}` }));
}

/**
 * Подсказка: id случайного ложного варианта, не своего. `''`, если после удаления не останется
 * ни одного ложного не своего (т.е. кандидатов меньше двух).
 */
export function pickHint(
  options: readonly Option[],
  playerId: string,
  rnd: Rnd = Math.random,
): string {
  const cands = options.filter((o) => o.kind !== 'truth' && !o.authors.includes(playerId));
  if (cands.length < 2) return '';
  return cands[Math.floor(rnd() * cands.length)]?.id ?? '';
}

export { scoreRound } from './scoring.js';
