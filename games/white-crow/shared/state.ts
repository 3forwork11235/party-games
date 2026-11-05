import { ArraySchema, MapSchema, type } from '@colyseus/schema';
import { CoreState } from '@party/core/server';
import { DEFAULT_ROUNDS } from './config.js';

export class CrowState extends CoreState {
  /** Выбранные паки (lobby). */
  @type(['string']) packs = new ArraySchema<string>();
  @type('number') rounds = DEFAULT_ROUNDS;
  /** Правило каждого раунда (индекс = round − 1). */
  @type(['string']) rules = new ArraySchema<string>();
  /** `"<packId>/<index>"` текущего вопроса. */
  @type('string') questionId = '';
  /** Индексы показанных вариантов в порядке показа. */
  @type(['number']) options = new ArraySchema<number>();
  /** Кто уже выбрал (без выбора). */
  @type(['string']) picked = new ArraySchema<string>();
  /** Кто подглядывал в этой партии. */
  @type(['string']) peekers = new ArraySchema<string>();
  /** playerId → вариант; только в roundEnd. */
  @type({ map: 'number' }) picks = new MapSchema<number>();
  @type({ map: 'number' }) lone = new MapSchema<number>();
  @type({ map: 'number' }) matches = new MapSchema<number>();
}
