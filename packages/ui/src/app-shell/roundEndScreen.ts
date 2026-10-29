import { NICK_COLORS, type ICoreState } from '@party/core/shared';
import { h } from '../dom.js';
import type { Component, TFunction } from '../types.js';
import { createScoreboard } from '../widgets/scoreboard.js';
import type { GameContext, GameView, MountGame } from './types.js';

export interface RoundEndScreen extends Component {
  update(state: ICoreState): void;
}

/** Экран roundEnd: таблица очков раунда. */
export function createRoundEndScreen<S extends ICoreState = ICoreState>(
  t: TFunction,
  custom?: { ctx: GameContext<S>; mount: MountGame<S> },
): RoundEndScreen {
  const title = h(
    'div',
    { class: 'p-title', style: 'text-align:center' },
    t('core.phase.round_end'),
  );
  if (custom) {
    const box = h('div', { class: 'p-game', style: 'flex:1;display:flex;flex-direction:column' });
    const el = h('div', { class: 'p-screen p-roundend' }, [title, box]);
    const view: GameView<S> = custom.mount(box, custom.ctx);
    return {
      el,
      update: (state) => view.update(state as S),
      destroy() {
        view.destroy();
        el.remove();
      },
    };
  }
  const board = createScoreboard({ nickColors: NICK_COLORS });
  const el = h('div', { class: 'p-screen p-roundend' }, [title, board.el]);
  return {
    el,
    update(state) {
      board.update([...state.players.values()]);
    },
    destroy() {
      board.destroy();
      el.remove();
    },
  };
}
