import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { CoreState } from '@party/core/server';
import { DEFAULT_ROUNDS } from './config.js';

export class BluffOption extends Schema {
  @type('string') id = '';
  @type('string') text = '';
}

export class BluffState extends CoreState {
  /** Выбранные паки (lobby). */
  @type(['string']) packs = new ArraySchema<string>();
  /** Выбор хоста: число вопросов 5/7/10 (lobby). */
  @type('number') rounds = DEFAULT_ROUNDS;
  /** Язык вопросов `ru`/`kk`/`en`; '' — ещё не задан (сервер считает `ru`). */
  @type('string') lang = '';
  /** `write`/`vote`, '' вне round. */
  @type('string') stage = '';
  @type('string') questionId = '';
  /** Id пака текущего вопроса. */
  @type('string') category = '';
  @type('string') question = '';
  /** Кто отправил выдумку / проголосовал (без содержания). */
  @type(['string']) submitted = new ArraySchema<string>();
  @type(['string']) voted = new ArraySchema<string>();
  /** Варианты (с vote), без признака правды и авторов. */
  @type([BluffOption]) options = new ArraySchema<BluffOption>();
  // Раскрытие: заполняется только в roundEnd.
  @type('string') truthId = '';
  /** автор → id его варианта. */
  @type({ map: 'string' }) lies = new MapSchema<string>();
  /** голосующий → id варианта. */
  @type({ map: 'string' }) votes = new MapSchema<string>();
}
