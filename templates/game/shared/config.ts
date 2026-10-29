import { DEFAULT_GAME_CONFIG, type GameConfig } from '@party/core/shared';

export const SLUG = '__SLUG__';

export const gameConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  slug: SLUG,
};
