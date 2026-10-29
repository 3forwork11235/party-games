import { ArraySchema, MapSchema, type } from '@colyseus/schema';
import { CoreState } from '@party/core/server';
import { TARGET_TAPS } from './config.js';

export class ClickerState extends CoreState {
  @type('number') target = TARGET_TAPS;
  /** playerId → нажатий в текущем раунде. */
  @type({ map: 'number' }) clicks = new MapSchema<number>();
  /** playerId в порядке достижения target. */
  @type(['string']) finishOrder = new ArraySchema<string>();
}
