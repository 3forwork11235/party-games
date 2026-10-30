import { ArraySchema, MapSchema, type } from '@colyseus/schema';
import { CoreState } from '@party/core/server';
import { DEFAULT_ROUNDS } from './config.js';

export class SpyState extends CoreState {
  /** Выбранные паки (lobby). */
  @type(['string']) packs = new ArraySchema<string>();
  /** Выбор хоста: число раундов 3/5/8 (lobby). */
  @type('number') rounds = DEFAULT_ROUNDS;
  /** `roles`/`discussion`/`voting`/`lastChance`, '' вне round. */
  @type('string') stage = '';
  /** Id локаций поля раунда (`"<pack>/<idx>"`), среди них настоящая. */
  @type(['string']) board = new ArraySchema<string>();
  @type('string') askerId = '';
  @type('string') targetId = '';
  @type('string') lastAskerId = '';
  /** Сколько вопросов задано в раунде. */
  @type('number') questions = 0;
  /** Нажали «Понял» (roles). */
  @type(['string']) seen = new ArraySchema<string>();
  /** Хотят голосовать досрочно. */
  @type(['string']) voteCalls = new ArraySchema<string>();
  /** Кто проголосовал (без цели). */
  @type(['string']) voted = new ArraySchema<string>();
  // Раскрытие: заполняется только в roundEnd.
  @type('string') spyId = '';
  @type('string') locationId = '';
  @type('string') accusedId = '';
  @type('string') guessId = '';
  @type('string') outcome = '';
  /** voter → target (только в roundEnd). */
  @type({ map: 'string' }) votes = new MapSchema<string>();
}
