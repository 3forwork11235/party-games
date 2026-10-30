import { POINTS } from './config.js';
import type { Option } from './logic.js';

/**
 * Очки раунда: выбрал правду +2; за каждого выбравшего твою выдумку +1 (общая — каждому автору).
 * Выдумки игры очков не дают. Игроки без голоса/выдумки — 0.
 */
export function scoreRound(
  options: readonly Option[],
  votes: ReadonlyMap<string, string>,
  players: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of players) out[id] = 0;
  const byId = new Map(options.map((o) => [o.id, o]));
  for (const [voter, optionId] of votes) {
    const opt = byId.get(optionId);
    if (!opt || !(voter in out) || opt.authors.includes(voter)) continue;
    if (opt.kind === 'truth') out[voter] = (out[voter] ?? 0) + POINTS.truth;
    else {
      for (const a of opt.authors) if (a in out) out[a] = (out[a] ?? 0) + POINTS.fooled;
    }
  }
  return out;
}
