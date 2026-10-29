import type { ICoreState } from '@party/core/shared';
import { h } from '../dom.js';
import type { Component, TFunction } from '../types.js';
import { createTimer } from '../widgets/timer.js';
import type { GameContext, GameView, MountGame } from './types.js';

export interface GameScreen<S extends ICoreState> extends Component {
  update(state: S): void;
}

/** Экран countdown/round: заголовок фазы, таймер и контейнер игры (mountGame). */
export function createGameScreen<S extends ICoreState>(
  t: TFunction,
  ctx: GameContext<S>,
  mountGame: MountGame<S>,
): GameScreen<S> {
  const title = h('div', { class: 'p-title', style: 'text-align:center' });
  const timer = createTimer();
  const box = h('div', { class: 'p-game', style: 'flex:1;display:flex;flex-direction:column' });
  const el = h('div', { class: 'p-screen p-game-screen' }, [title, timer.el, box]);
  const view: GameView<S> = mountGame(box, ctx);

  return {
    el,
    update(state) {
      title.textContent =
        state.phase === 'countdown'
          ? t('core.phase.countdown')
          : t('core.phase.round', { round: state.round });
      timer.update(state.phaseEndsAt, () => ctx.client.serverNow());
      view.update(state);
    },
    destroy() {
      timer.destroy();
      view.destroy();
      el.remove();
    },
  };
}
