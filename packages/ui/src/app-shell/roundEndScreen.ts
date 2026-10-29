import { NICK_COLORS, type ICoreState } from '@party/core/shared';
import { h } from '../dom.js';
import type { Component, TFunction } from '../types.js';
import { createScoreboard } from '../widgets/scoreboard.js';

export interface RoundEndScreen extends Component {
  update(state: ICoreState): void;
}

/** Экран roundEnd: таблица очков раунда. */
export function createRoundEndScreen(t: TFunction): RoundEndScreen {
  const title = h(
    'div',
    { class: 'p-title', style: 'text-align:center' },
    t('core.phase.round_end'),
  );
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
