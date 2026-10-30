import type { Entitlements } from './contracts.js';

export interface PackInfo {
  id: string;
  free: boolean;
}

/**
 * Доступные паки игры: бесплатные + купленные (`${game}/${id}`);
 * бандл `${game}/all` открывает все.
 */
export function ownedPacks(
  ent: Entitlements,
  game: string,
  packs: readonly PackInfo[],
): Set<string> {
  const all = ent.packs.has(`${game}/all`);
  const out = new Set<string>();
  for (const p of packs) {
    if (p.free || all || ent.packs.has(`${game}/${p.id}`)) out.add(p.id);
  }
  return out;
}
