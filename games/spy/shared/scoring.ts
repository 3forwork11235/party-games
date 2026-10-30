import { POINTS } from './config.js';

/**
 * Исход раунда:
 * - `spy_guessed` — шпион назвал локацию (досрочно или в последний шанс);
 * - `spy_wrong` — досрочная догадка неверна;
 * - `spy_caught` — обвинён и не угадал (или был офлайн);
 * - `spy_escaped` — обвинён невиновный, ничья или нет голосов.
 */
export type Outcome = 'spy_guessed' | 'spy_wrong' | 'spy_caught' | 'spy_escaped';

export interface ScoreInput {
  outcome: Outcome;
  spyId: string;
  /** Все игроки раунда (включая отключённых в окне реконнекта). */
  players: readonly string[];
  /** voter → target. */
  votes: ReadonlyMap<string, string>;
}

/** Очки за раунд: playerId → points (по записи для каждого игрока). */
export function scoreRound({ outcome, spyId, players, votes }: ScoreInput): Record<string, number> {
  const points: Record<string, number> = {};
  for (const id of players) points[id] = 0;
  const add = (id: string, n: number): void => {
    if (id in points) points[id] = (points[id] ?? 0) + n;
  };
  // «Верное вычисление»: голос за шпиона при любом исходе после голосования
  for (const [voter, target] of votes) {
    if (voter !== spyId && target === spyId) add(voter, POINTS.vote);
  }
  if (outcome === 'spy_caught' || outcome === 'spy_wrong') {
    for (const id of players) if (id !== spyId) add(id, POINTS.team);
  } else if (outcome === 'spy_escaped') {
    add(spyId, POINTS.escaped);
  } else {
    add(spyId, POINTS.guessed);
  }
  return points;
}
