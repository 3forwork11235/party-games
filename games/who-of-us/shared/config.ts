import { DEFAULT_GAME_CONFIG, type GameConfig } from '@party/core/shared';

export const SLUG = 'who-of-us';

export const gameConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  slug: SLUG,
  minPlayers: 3,
  maxPlayers: 10,
  rounds: 10,
  countdownMs: 3000,
  roundMs: 20000,
  roundEndMs: 9000,
};

/** Пропусков вопроса на партию. */
export const MAX_SKIPS = 2;
/** Очки за догадку о выборе большинства. */
export const GUESS_POINTS = 2;
