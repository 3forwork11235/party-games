import { RULES, type Rule } from './config.js';
import { PACKS, type PackId } from './packs.js';

export function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Правила по раундам: блоки по 3 (каждое правило раз в блоке), на стыке без повтора подряд. */
export function buildRules(rounds: number, rnd: () => number = Math.random): Rule[] {
  const out: Rule[] = [];
  while (out.length < rounds) {
    const block = shuffle(RULES, rnd);
    const prev = out[out.length - 1];
    if (prev !== undefined && block[0] === prev) {
      [block[0], block[2]] = [block[2] as Rule, block[0] as Rule];
    }
    out.push(...block);
  }
  return out.slice(0, Math.max(0, rounds));
}

function poolOf(packs: readonly PackId[]): string[] {
  const out: string[] = [];
  for (const id of new Set(packs)) {
    const size = PACKS.find((p) => p.id === id)?.size ?? 0;
    for (let i = 0; i < size; i++) out.push(`${id}/${i}`);
  }
  return out;
}

/** Колода из count вопросов: сначала не использованные в комнате, затем добор; повторы — только если вопросов мало. */
export function buildDeck(
  packs: readonly PackId[],
  count: number,
  used: ReadonlySet<string>,
  rnd: () => number = Math.random,
): string[] {
  const pool = poolOf(packs);
  if (pool.length === 0 || count <= 0) return [];
  const fresh = shuffle(
    pool.filter((q) => !used.has(q)),
    rnd,
  );
  const old = shuffle(
    pool.filter((q) => used.has(q)),
    rnd,
  );
  const base = [...fresh, ...old];
  const out: string[] = [];
  while (out.length < count) {
    out.push(...(out.length === 0 ? base : shuffle(pool, rnd)));
  }
  return out.slice(0, count);
}

/** Сколько вариантов показать при данном числе игроков. */
export function shownCount(players: number): number {
  return Math.min(6, Math.max(4, players + 1));
}

/** Индексы показанных вариантов (0..5) в порядке показа. */
export function pickShown(players: number, rnd: () => number = Math.random): number[] {
  return shuffle([0, 1, 2, 3, 4, 5], rnd).slice(0, shownCount(players));
}
