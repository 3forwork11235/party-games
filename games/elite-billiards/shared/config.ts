import { DEFAULT_GAME_CONFIG, type GameConfig } from '@party/core/shared';

export const SLUG = 'elite-billiards';

/** Время на удар (таймер фазы round в стадии aim). */
export const SHOT_MS = 35000;
/** Запас после конца анимации удара, прежде чем сервер применит итог. */
export const ROLL_GRACE_MS = 700;
/** Лимит на одну раскладку: по истечении (на разрешении удара) раунд заканчивается. */
export const RACK_MAX_MS = 7 * 60 * 1000;
/** Штрафы (очки раунда стрелка). */
export const PENALTY_SCRATCH = 2;
export const PENALTY_NO_HIT = 1;
export const PENALTY_TIMEOUT = 1;
/** Лимит сообщений прицела от стрелка (сервер ретранслирует остальным). */
export const AIM_MAX_PER_SEC = 10;
/** Боты: время «раздумья» [мин, макс] мс, ошибка угла (°), ошибка силы (доля), бюджет симуляций на удар. */
export const BOT_THINK_MS: readonly [number, number] = [1500, 3000];
export const BOT_AIM_NOISE_DEG = 0.9;
export const BOT_POWER_NOISE = 0.08;
export const BOT_MAX_SIMS = 12;
/** За сколько мс до удара бот рассылает прицел. */
export const BOT_AIM_LEAD_MS = 700;

export const gameConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  slug: SLUG,
  minPlayers: 2,
  maxPlayers: 8,
  maxBots: 7,
  rounds: 3,
  countdownMs: 3000,
  /** roundMs = таймер удара; раунд (раскладка) длится, пока есть шары. */
  roundMs: SHOT_MS,
  roundEndMs: 7000,
  idleKickSec: 900,
};
