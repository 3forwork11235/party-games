import { FINAL_MULTIPLIER, POINTS, type Rule } from './config.js';

export { FINAL_MULTIPLIER };

/** вариант → игроки, выбравшие его. */
export function groupPicks(picks: ReadonlyMap<string, number>): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [id, option] of picks) {
    const list = out.get(option);
    if (list) list.push(id);
    else out.set(option, [id]);
  }
  return out;
}

/** Очки раунда по правилу (только игроки с очками > 0). */
export function scoreRound(
  rule: Rule,
  picks: ReadonlyMap<string, number>,
  mult = 1,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ids of groupPicks(picks).values()) {
    const pts =
      rule === 'flock'
        ? (ids.length - 1) * POINTS.flockPerMatch
        : rule === 'pair'
          ? ids.length === 2
            ? POINTS.pair
            : 0
          : ids.length === 1
            ? POINTS.odd
            : 0;
    if (pts > 0) for (const id of ids) out[id] = pts * mult;
  }
  return out;
}

/** lone — единственные на варианте; matches — число других на том же варианте (> 0). */
export function roundStats(picks: ReadonlyMap<string, number>): {
  lone: string[];
  matches: Record<string, number>;
} {
  const lone: string[] = [];
  const matches: Record<string, number> = {};
  for (const ids of groupPicks(picks).values()) {
    if (ids.length === 1) lone.push(ids[0] as string);
    else for (const id of ids) matches[id] = ids.length - 1;
  }
  return { lone, matches };
}
