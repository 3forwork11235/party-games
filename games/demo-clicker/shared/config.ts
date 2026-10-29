import { DEFAULT_GAME_CONFIG, type GameConfig } from '@party/core/shared';

export const SLUG = 'demo-clicker';

/** Сколько нажатий нужно для победы в раунде. */
export const TARGET_TAPS = 30;
/** Лимит нажатий от одного игрока: не более MAX_TAPS_PER_WINDOW за скользящее окно TAP_WINDOW_MS. */
export const MAX_TAPS_PER_WINDOW = 20;
export const TAP_WINDOW_MS = 1000;

export const gameConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  slug: SLUG,
  rounds: 3,
  countdownMs: 3000,
  roundMs: 20000,
  roundEndMs: 4000,
};
