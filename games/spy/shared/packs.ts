export type PackId = 'city' | 'travel' | 'leisure' | 'movies' | 'space' | 'history';

export interface PackInfo {
  id: PackId;
  free: boolean;
  size: 20;
}

export const PACKS: readonly PackInfo[] = [
  { id: 'city', free: true, size: 20 },
  { id: 'travel', free: true, size: 20 },
  { id: 'leisure', free: true, size: 20 },
  { id: 'movies', free: false, size: 20 },
  { id: 'space', free: false, size: 20 },
  { id: 'history', free: false, size: 20 },
];

export const DEFAULT_PACKS: readonly PackId[] = ['city', 'travel', 'leisure'];

export function isPackId(v: unknown): v is PackId {
  return typeof v === 'string' && PACKS.some((p) => p.id === v);
}

/** Все id локаций выбранных паков: `"<pack>/<idx>"` (дубли паков игнорируются). */
export function locationIds(packs: readonly PackId[]): string[] {
  const out: string[] = [];
  for (const info of PACKS) {
    if (!packs.includes(info.id)) continue;
    for (let i = 0; i < info.size; i++) out.push(`${info.id}/${i}`);
  }
  return out;
}

/** Разбор id локации; `null`, если формат или диапазон неверны. */
export function parseLocationId(id: string): { pack: PackId; index: number } | null {
  if (typeof id !== 'string') return null;
  const slash = id.indexOf('/');
  if (slash <= 0) return null;
  const pack = id.slice(0, slash);
  const rest = id.slice(slash + 1);
  if (!isPackId(pack) || !/^(0|[1-9]\d*)$/.test(rest)) return null;
  const index = Number(rest);
  const info = PACKS.find((p) => p.id === pack);
  if (!info || index >= info.size) return null;
  return { pack, index };
}
