import { GUESS_POINTS } from './config.js';

export interface Vote {
  target: string;
  guess: string;
}

/** Голоса за каждого игрока; голоса за отсутствующих не учитываются. */
export function tallyVotes(votes: Map<string, Vote>, present: Set<string>): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const v of votes.values()) {
    if (present.has(v.target)) tally[v.target] = (tally[v.target] ?? 0) + 1;
  }
  return tally;
}

/** Игрок(и) с максимумом голосов; пусто, если голосов нет. */
export function findLeaders(tally: Record<string, number>): string[] {
  let max = 0;
  for (const n of Object.values(tally)) max = Math.max(max, n);
  if (max === 0) return [];
  return Object.keys(tally).filter((id) => tally[id] === max);
}

/** +GUESS_POINTS каждому, чья догадка входит в лидеров. */
export function scoreRound(votes: Map<string, Vote>, leaders: string[]): Record<string, number> {
  const points: Record<string, number> = {};
  if (leaders.length === 0) return points;
  for (const [id, v] of votes) {
    if (leaders.includes(v.guess)) points[id] = GUESS_POINTS;
  }
  return points;
}
