import { DEFAULT_GAME_CONFIG, type GameConfig } from '@party/core/shared';

export const SLUG = 'white-crow';

export const gameConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  slug: SLUG,
  minPlayers: 3,
  maxPlayers: 8,
  rounds: 9,
  countdownMs: 4000,
  roundMs: 20000,
  roundEndMs: 10000,
  maxBots: 7,
};

export const ROUND_OPTIONS = [6, 9, 12] as const;
export const DEFAULT_ROUNDS = 9;

/** flock — стая, pair — пара, odd — белая ворона. */
export const RULES = ['flock', 'pair', 'odd'] as const;
export type Rule = (typeof RULES)[number];

export function isRule(v: unknown): v is Rule {
  return typeof v === 'string' && (RULES as readonly string[]).includes(v);
}

/** Вариантов у каждого вопроса. */
export const OPTIONS_PER_QUESTION = 6;

export const POINTS = { flockPerMatch: 1, pair: 3, odd: 3 } as const;
export const FINAL_MULTIPLIER = 2;

/** Задержка выбора бота после старта раунда, мс [min, max]. */
export const BOT_DELAY_MS = [2000, 9000] as const;
