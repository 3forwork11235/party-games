export type PackId = 'words' | 'facts' | 'laws' | 'records';

export interface PackInfo {
  id: PackId;
  free: boolean;
  size: 100;
}

export const PACKS: readonly PackInfo[] = [
  { id: 'words', free: true, size: 100 },
  { id: 'facts', free: true, size: 100 },
  { id: 'laws', free: false, size: 100 },
  { id: 'records', free: false, size: 100 },
];

export const DEFAULT_PACKS: readonly PackId[] = ['words', 'facts'];

export function isPackId(v: unknown): v is PackId {
  return typeof v === 'string' && PACKS.some((p) => p.id === v);
}

/** Все id вопросов выбранных паков: `"<pack>/<idx>"` (дубли паков игнорируются). */
export function questionIds(packs: readonly PackId[]): string[] {
  const out: string[] = [];
  for (const info of PACKS) {
    if (!packs.includes(info.id)) continue;
    for (let i = 0; i < info.size; i++) out.push(`${info.id}/${i}`);
  }
  return out;
}

/** Разбор id вопроса; `null`, если формат или диапазон неверны. */
export function parseQuestionId(id: string): { pack: PackId; index: number } | null {
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
