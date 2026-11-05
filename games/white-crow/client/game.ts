import { h } from '@party/ui';
import type { GameContext, GameView } from '@party/ui/app-shell';
import type { CrowPublicState } from '../shared/types.js';
import { createPickPanel } from './pick.js';
import { questionOf } from './questions.js';
import { ruleEmoji } from './util.js';
import { createYouTracker } from './you.js';

export function mountGame(
  container: HTMLElement,
  ctx: GameContext<CrowPublicState>,
): GameView<CrowPublicState> {
  const { t } = ctx;
  let last: CrowPublicState | null = null;
  let raf = 0;

  const counter = h('div', { class: 'crow-counter' });
  const bigEmoji = h('div', { class: 'crow-big__emoji' });
  const bigName = h('div', { class: 'crow-big__name' });
  const bigDesc = h('div', { class: 'crow-big__desc' });
  const bigFinal = h('div', { class: 'crow-big__final' });
  const bigCount = h('div', { class: 'crow-big__count' });
  const big = h('div', { class: 'crow-big' }, [bigEmoji, bigName, bigDesc, bigFinal, bigCount]);

  const chipEmoji = h('span', { class: 'crow-chip__emoji' });
  const chipName = h('span', { class: 'crow-chip__name' });
  const chipX2 = h('span', { class: 'crow-chip__x2' }, '×2');
  const chip = h('div', { class: 'crow-chip' }, [chipEmoji, chipName, chipX2]);
  const question = h('div', { class: 'crow-question' });

  const you = createYouTracker(ctx.client, () => {
    if (last) render(last);
  });
  const pick = createPickPanel(ctx, you);
  const roundBox = h('div', { class: 'crow-round' }, [chip, question, pick.el]);
  const root = h('div', { class: 'crow-game' }, [counter, big, roundBox]);
  container.append(root);

  const tick = (): void => {
    if (!last || last.phase !== 'countdown') return;
    const left = Math.max(0, last.phaseEndsAt - ctx.client.serverNow());
    bigCount.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    raf = requestAnimationFrame(tick);
  };

  function render(state: CrowPublicState): void {
    const isCount = state.phase === 'countdown';
    const isRound = state.phase === 'round';
    const rule = state.rules[state.round - 1] ?? 'flock';
    const isFinal = state.round >= state.totalRounds;
    counter.textContent = t('crow.round', { round: state.round, total: state.totalRounds });
    big.hidden = !isCount;
    roundBox.hidden = !isRound;
    if (isCount) {
      bigEmoji.textContent = ruleEmoji(rule);
      bigName.textContent = t(`crow.rule.${rule}.name`);
      bigDesc.textContent = t(`crow.rule.${rule}.desc`);
      bigFinal.textContent = isFinal ? t('crow.final') : '';
      bigFinal.hidden = !isFinal;
    }
    if (isRound) {
      chipEmoji.textContent = ruleEmoji(rule);
      chipName.textContent = t(`crow.rule.${rule}.name`);
      chipX2.hidden = !isFinal;
      question.textContent = questionOf(state.questionId)?.q ?? '';
      pick.update(state);
    }
  }

  return {
    update(state) {
      const prev = last?.phase;
      last = state;
      you.sync(state);
      render(state);
      if (state.phase === 'countdown' && prev !== 'countdown') {
        cancelAnimationFrame(raf);
        tick();
      } else if (state.phase !== 'countdown') {
        cancelAnimationFrame(raf);
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      you.destroy();
      pick.destroy();
      root.remove();
    },
  };
}
