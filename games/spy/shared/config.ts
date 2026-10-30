import { DEFAULT_GAME_CONFIG, type GameConfig } from '@party/core/shared';

export const SLUG = 'spy';

/** Стадия `roles` — это roundMs: core запускает таймер round на неё. */
export const ROLES_MS = 15000;
export const DISCUSSION_MS = 300000;
export const VOTING_MS = 45000;
export const LAST_CHANCE_MS = 20000;

export const gameConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  slug: SLUG,
  minPlayers: 3,
  maxPlayers: 8,
  rounds: 5,
  countdownMs: 3000,
  roundMs: ROLES_MS,
  roundEndMs: 12000,
  idleKickSec: 600,
};

/** Локаций на поле раунда. */
export const BOARD_SIZE = 24;
/** Сколько неверных локаций зачёркивает одна подсказка. */
export const HINT_CROSS = 6;
/** Подсказок шпиону за раунд (2-я — после rewarded на клиенте). */
export const MAX_HINTS = 2;
/** Ролей в каждой локации (кроме шпиона). */
export const ROLES_PER_LOCATION = 7;
/** Допустимое число раундов (выбор хоста). */
export const ROUND_OPTIONS = [3, 5, 8] as const;
export const DEFAULT_ROUNDS = 5;
/** Максимум паков в выборе хоста. */
export const MAX_SELECTED_PACKS = 6;

export const POINTS = { vote: 1, team: 1, escaped: 2, guessed: 4 } as const;

export function isRoundOption(v: unknown): v is (typeof ROUND_OPTIONS)[number] {
  return typeof v === 'number' && (ROUND_OPTIONS as readonly number[]).includes(v);
}
