import { PACKS, type PackId } from './packs.js';

function poolOf(packs: readonly PackId[]): string[] {
  const out: string[] = [];
  for (const id of new Set(packs)) {
    const size = PACKS.find((p) => p.id === id)?.size ?? 0;
    for (let i = 0; i < size; i++) out.push(`${id}/${i}`);
  }
  return out;
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

/** Колода из count неповторяющихся вопросов "pack/idx"; если их меньше — сколько есть. */
export function buildDeck(packs: readonly PackId[], count: number, rnd = Math.random): string[] {
  return shuffle(poolOf(packs), rnd).slice(0, Math.max(0, count));
}

/** Вопрос для замены при пропуске: из выбранных паков, ещё не в deck/used; null — если не осталось. */
export function drawReplacement(
  deck: readonly string[],
  used: ReadonlySet<string>,
  packs: readonly PackId[],
  rnd = Math.random,
): string | null {
  const taken = new Set([...deck, ...used]);
  const free = poolOf(packs).filter((q) => !taken.has(q));
  if (free.length === 0) return null;
  return free[Math.floor(rnd() * free.length)] as string;
}
