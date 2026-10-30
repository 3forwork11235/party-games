import { DEFAULT_GAME_CONFIG, type GameConfig } from '@party/core/shared';

export const SLUG = 'bluffopedia';

/** Стадия `write` — это roundMs: core запускает таймер round на неё. */
export const gameConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  slug: SLUG,
  minPlayers: 3,
  maxPlayers: 8,
  rounds: 7,
  countdownMs: 3000,
  roundMs: 45000,
  roundEndMs: 15000,
  idleKickSec: 300,
};

export const VOTE_MS = 30000;
/** Максимум графем в выдумке. */
export const LIE_MAX = 40;
/** Минимум вариантов в голосовании (добивка «выдумками игры»). */
export const MIN_OPTIONS = 4;
export const ROUND_OPTIONS = [5, 7, 10] as const;
export const DEFAULT_ROUNDS = 7;
export const LANGS = ['ru', 'kk', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const POINTS = { truth: 2, fooled: 1 } as const;

export function isRoundOption(v: unknown): v is (typeof ROUND_OPTIONS)[number] {
  return typeof v === 'number' && (ROUND_OPTIONS as readonly number[]).includes(v);
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}
