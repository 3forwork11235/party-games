import { h } from '@party/ui';
import type { GameContext, GameView } from '@party/ui/app-shell';
import { SLUG } from '../shared/config.js';
import { MSG_SKIP } from '../shared/messages.js';
import type { WhoOfUsPublicState } from '../shared/types.js';
import { questionText } from './questions.js';
import { packOf } from './util.js';
import { createVotePanel } from './vote.js';

/** Пропускал ли я вопрос в этой партии (экран игры пересоздаётся каждый раунд — флаг вне него). */
let skippedByMe = false;
export function resetSkipFlag(): void {
  skippedByMe = false;
}

export function mountGame(
  container: HTMLElement,
  ctx: GameContext<WhoOfUsPublicState>,
): GameView<WhoOfUsPublicState> {
  const { t } = ctx;
  const counter = h('div', { class: 'wou-counter' });
  const question = h('div', { class: 'wou-question' });
  const vote = createVotePanel(ctx);
  const skip = h('button', { type: 'button', class: 'p-btn wou-skip' }, t('whoOfUs.skip'));
  const root = h('div', { class: 'wou-game' }, [counter, question, vote.el, skip]);
  container.append(root);

  let last: WhoOfUsPublicState | null = null;
  let busy = false;
  let raf = 0;

  const refreshSkip = (state: WhoOfUsPublicState): void => {
    skip.hidden = !(
      state.phase === 'round' &&
      state.skipsLeft > 0 &&
      !skippedByMe &&
      !busy &&
      ctx.ads.canShowRewarded()
    );
  };

  skip.addEventListener('click', () => {
    if (!last || busy) return;
    const { round, questionId } = last;
    busy = true;
    refreshSkip(last);
    void ctx.ads
      .showRewarded('skip_question')
      .then((ok) => {
        if (!ok) return;
        skippedByMe = true;
        ctx.client.sendGame(MSG_SKIP, {});
        ctx.track('question_skipped', { game: SLUG, round, packId: packOf(questionId) });
      })
      .finally(() => {
        busy = false;
        if (last) refreshSkip(last);
      });
  });

  const tickCountdown = (): void => {
    if (!last || last.phase !== 'countdown') return;
    const left = Math.max(0, last.phaseEndsAt - ctx.client.serverNow());
    question.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    raf = requestAnimationFrame(tickCountdown);
  };

  return {
    update(state) {
      const prev = last?.phase;
      last = state;
      const isRound = state.phase === 'round';
      vote.el.hidden = !isRound;
      counter.textContent = t('whoOfUs.questionOf', {
        round: state.round,
        total: state.totalRounds,
      });
      if (state.phase === 'countdown') {
        if (prev !== 'countdown') {
          cancelAnimationFrame(raf);
          question.classList.add('wou-question--count');
          tickCountdown();
        }
      } else {
        cancelAnimationFrame(raf);
        question.classList.remove('wou-question--count');
        question.textContent = questionText(state.questionId);
      }
      if (isRound) vote.update(state);
      refreshSkip(state);
    },
    destroy() {
      cancelAnimationFrame(raf);
      vote.destroy();
      root.remove();
    },
  };
}
