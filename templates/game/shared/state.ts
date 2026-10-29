import { type } from '@colyseus/schema';
import { CoreState } from '@party/core/server';

export class __PASCAL__State extends CoreState {
  /** Пример игрового поля: число нажатий в текущем раунде. */
  @type('number') taps = 0;
}
