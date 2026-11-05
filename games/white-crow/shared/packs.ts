export type PackId = 'everyday' | 'fantasy' | 'food' | 'world';

export interface PackInfo {
  id: PackId;
  free: boolean;
  size: 40;
}

export const PACKS: readonly PackInfo[] = [
  { id: 'everyday', free: true, size: 40 },
  { id: 'fantasy', free: true, size: 40 },
  { id: 'food', free: false, size: 40 },
  { id: 'world', free: false, size: 40 },
];

export const DEFAULT_PACKS: readonly PackId[] = ['everyday', 'fantasy'];

export function isPackId(v: unknown): v is PackId {
  return typeof v === 'string' && PACKS.some((p) => p.id === v);
}

/** `"<pack>/<index>"` → части; null, если id некорректен. */
export function parseQuestionId(id: string): { pack: PackId; index: number } | null {
  const m = /^([a-z]+)\/(\d+)$/.exec(id);
  if (!m) return null;
  const pack = m[1];
  const index = Number(m[2]);
  if (!isPackId(pack)) return null;
  const size = PACKS.find((p) => p.id === pack)?.size ?? 0;
  return index < size ? { pack, index } : null;
}
