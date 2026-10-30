import type { AnalyticsEventMap } from '@party/analytics';
import { SLUG } from '../shared/config.js';

/** Факты раскрытия из публичного состояния roundEnd. */
export interface RevealFacts {
  round: number;
  spyId: string;
  locationId: string;
  accusedId: string;
  guessId: string;
  outcome: string;
  players: number;
}

export interface RevealEvents {
  guessed?: AnalyticsEventMap['location_guessed'];
  won?: AnalyticsEventMap['spy_won'];
}

/**
 * События шпиона за раунд: шлёт только клиент шпиона (`me === spyId`), по раскрытии.
 * Пусто, пока исход не опубликован или если игрок — не шпион.
 */
export function revealEvents(me: string, f: RevealFacts): RevealEvents {
  if (!me || f.spyId !== me || f.outcome === '') return {};
  const out: RevealEvents = {};
  if (f.guessId !== '') {
    out.guessed = {
      game: SLUG,
      round: f.round,
      locationId: f.guessId,
      correct: f.guessId === f.locationId,
      early: f.accusedId === '',
    };
  }
  if (f.outcome === 'spy_guessed' || f.outcome === 'spy_escaped') {
    out.won = {
      game: SLUG,
      round: f.round,
      reason: f.outcome === 'spy_guessed' ? 'guessed' : 'escaped',
      players: f.players,
    };
  }
  return out;
}
