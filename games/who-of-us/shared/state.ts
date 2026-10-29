import { ArraySchema, MapSchema, type } from '@colyseus/schema';
import { CoreState } from '@party/core/server';
import { MAX_SKIPS } from './config.js';

export class WhoOfUsState extends CoreState {
  /** Выбранные паки (lobby). */
  @type(['string']) packs = new ArraySchema<string>();
  /** `"<packId>/<index>"` текущего вопроса. */
  @type('string') questionId = '';
  /** Кто уже проголосовал (без цели). */
  @type(['string']) voted = new ArraySchema<string>();
  /** playerId → голосов; заполняется в roundEnd. */
  @type({ map: 'number' }) tally = new MapSchema<number>();
  @type(['string']) leaders = new ArraySchema<string>();
  /** Угадавшие большинство. */
  @type(['string']) correct = new ArraySchema<string>();
  /** playerId → сколько раз был лидером. */
  @type({ map: 'number' }) leaderCount = new MapSchema<number>();
  @type('number') skipsLeft = MAX_SKIPS;
}
