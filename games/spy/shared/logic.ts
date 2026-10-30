import { ROLES_PER_LOCATION } from './config.js';
import { locationIds, type PackId } from './packs.js';

export type Rnd = () => number;

function pickOne<T>(items: readonly T[], rnd: Rnd): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rnd() * items.length))];
}

/** Fisher–Yates; возвращает новую копию. */
function shuffle<T>(items: readonly T[], rnd: Rnd): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rnd() * (i + 1)));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/**
 * Шпион раунда: среди игроков с минимальным числом прошлых шпионств, не тот же, что в прошлом
 * раунде (если есть другие). Пустой список → ''.
 */
export function pickSpy(
  ids: readonly string[],
  spyCount: ReadonlyMap<string, number>,
  lastSpy: string,
  rnd: Rnd = Math.random,
): string {
  const others = ids.filter((id) => id !== lastSpy);
  const candidates = others.length > 0 ? others : [...ids];
  if (candidates.length === 0) return '';
  const counts = candidates.map((id) => spyCount.get(id) ?? 0);
  const min = Math.min(...counts);
  const pool = candidates.filter((_, i) => counts[i] === min);
  return pickOne(pool, rnd) ?? '';
}

/** Локация раунда: ещё не использованная в партии; все использованы → из всех. */
export function pickLocation(
  packs: readonly PackId[],
  used: ReadonlySet<string>,
  rnd: Rnd = Math.random,
): string {
  const all = locationIds(packs);
  const fresh = all.filter((id) => !used.has(id));
  return pickOne(fresh.length > 0 ? fresh : all, rnd) ?? '';
}

/** Поле раунда: перемешанные уникальные локации, среди них `locationId`; не больше `size`. */
export function buildBoard(
  packs: readonly PackId[],
  locationId: string,
  size: number,
  rnd: Rnd = Math.random,
): string[] {
  const others = locationIds(packs).filter((id) => id !== locationId);
  const n = Math.max(1, Math.min(size, others.length + 1));
  return shuffle([locationId, ...shuffle(others, rnd).slice(0, n - 1)], rnd);
}

/** Роли не-шпионов: разные индексы 0..ROLES_PER_LOCATION-1 (при избытке игроков — по кругу). */
export function assignRoles(ids: readonly string[], rnd: Rnd = Math.random): Map<string, number> {
  const indexes = shuffle(
    Array.from({ length: ROLES_PER_LOCATION }, (_, i) => i),
    rnd,
  );
  const roles = new Map<string, number>();
  ids.forEach((id, i) => roles.set(id, indexes[i % indexes.length] as number));
  return roles;
}

/**
 * Подсказка шпиону: новый накопленный список зачёркнутых (старые + до `n` новых). Зачёркиваются
 * только неверные локации, всего не больше `board.length - 1`.
 */
export function pickHint(
  board: readonly string[],
  locationId: string,
  crossed: readonly string[],
  n: number,
  rnd: Rnd = Math.random,
): string[] {
  const already = new Set(crossed);
  const wrong = board.filter((id) => id !== locationId && !already.has(id));
  const room = Math.max(0, board.length - 1 - crossed.length);
  const take = Math.max(0, Math.min(n, wrong.length, room));
  return [...crossed, ...shuffle(wrong, rnd).slice(0, take)];
}

/** Обвинённый — строго больше всех голосов; ничья или нет голосов → ''. */
export function findAccused(votes: ReadonlyMap<string, string>): string {
  const tally = new Map<string, number>();
  for (const target of votes.values()) {
    if (target) tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  let best = '';
  let bestN = 0;
  let tie = false;
  for (const [id, n] of tally) {
    if (n > bestN) {
      best = id;
      bestN = n;
      tie = false;
    } else if (n === bestN) tie = true;
  }
  return tie ? '' : best;
}

/**
 * Следующий по порядку входа подключённый игрок после `current` (по кругу). Никого другого
 * нет → `current`, если он подключён, иначе ''.
 */
export function nextAsker(
  order: readonly string[],
  current: string,
  connected: ReadonlySet<string>,
): string {
  const from = order.indexOf(current);
  for (let i = 1; i <= order.length; i++) {
    const id = order[(from + i) % order.length] as string;
    if (id !== current && connected.has(id)) return id;
  }
  return connected.has(current) ? current : '';
}
