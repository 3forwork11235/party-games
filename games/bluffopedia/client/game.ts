import { h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import type { BluffPublicState } from '../shared/types.js';
import type { BluffCtx } from './util.js';
import { createVotePanel } from './vote.js';
import { createWritePanel } from './write.js';
import { createYouTracker } from './you.js';

/** Экран игры: countdown → стадии round (`write` → `vote`). Раскрытие — в reveal.ts. */
export function mountGame(container: HTMLElement, ctx: BluffCtx): GameView<BluffPublicState> {
  const { t } = ctx;
  let last: BluffPublicState | null = null;
  let raf = 0;

  const refresh = (): void => {
    if (last) render(last);
  };
  const tracker = createYouTracker(ctx.client, refresh);
  const write = createWritePanel(ctx);
  const vote = createVotePanel(ctx, refresh);

  const countNum = h('div', { class: 'bluff-count__num' });
  const countText = h('div', { class: 'bluff-count__text' });
  const count = h('div', { class: 'bluff-count' }, [countNum, countText]);
  const root = h('div', { class: 'bluff-game' }, [count, write.el, vote.el]);
  container.append(root);

  const tickCountdown = (): void => {
    if (!last || last.phase !== 'countdown') return;
    const left = Math.max(0, last.phaseEndsAt - ctx.client.serverNow());
    countNum.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    raf = requestAnimationFrame(tickCountdown);
  };

  function render(state: BluffPublicState): void {
    const inRound = state.phase === 'round';
    const stage = inRound ? state.stage : '';
    const you = tracker.get(state.round);

    count.hidden = !(state.phase === 'countdown' || (inRound && stage === ''));
    countText.textContent = t('bluff.dealing', { n: state.round, total: state.totalRounds });
    write.el.hidden = stage !== 'write';
    vote.el.hidden = stage !== 'vote';
    if (stage === 'write') write.update(state, you);
    if (stage === 'vote') vote.update(state, you);
  }

  return {
    update(state) {
      last = state;
      tracker.sync(state);
      if (state.phase === 'countdown') {
        if (!raf) tickCountdown();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      render(state);
    },
    destroy() {
      cancelAnimationFrame(raf);
      tracker.destroy();
      write.destroy();
      vote.destroy();
      root.remove();
    },
  };
}
