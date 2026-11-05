import type { GameContext, GameView } from '@party/ui/app-shell';
import type { CrowPublicState } from '../shared/types.js';

/** Заглушка до задачи G2: показывает questionId. */
export function mountGame(
  container: HTMLElement,
  ctx: GameContext<CrowPublicState>,
): GameView<CrowPublicState> {
  void ctx;
  const el = document.createElement('div');
  container.append(el);
  return {
    update(state) {
      el.textContent = state.questionId;
    },
    destroy() {
      el.remove();
    },
  };
}
