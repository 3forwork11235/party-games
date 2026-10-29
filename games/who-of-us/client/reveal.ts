import { clear, h } from '@party/ui';
import type { IPlayer } from '@party/core/shared';
import type { GameContext, GameView } from '@party/ui/app-shell';
import { GUESS_POINTS } from '../shared/config.js';
import type { WhoOfUsPublicState } from '../shared/types.js';
import { playEffect } from './effects.js';
import { questionText } from './questions.js';
import { avatarEl, listOf, playersOf, readCounts } from './util.js';

/** Столбики растут по очереди за это время, затем появляется лидер. */
const BARS_MS = 4000;
const BAR_ANIM_MS = 600;

/** Экран roundEnd: вопрос, столбики голосов, лидер(ы), «+2» угадавшим, косметический эффект. */
export function mountRoundEnd(
  container: HTMLElement,
  ctx: GameContext<WhoOfUsPublicState>,
): GameView<WhoOfUsPublicState> {
  const { t } = ctx;
  const question = h('div', { class: 'wou-question wou-question--small' });
  const bars = h('div', { class: 'wou-bars' });
  const verdict = h('div', { class: 'wou-verdict' });
  const guessed = h('div', { class: 'wou-guessed' });
  const titles = h('div', { class: 'wou-titles' });
  const fx = h('div', { class: 'wou-fxlayer', 'aria-hidden': 'true' });
  const root = h('div', { class: 'wou-reveal' }, [question, bars, verdict, guessed, titles, fx]);
  container.append(root);

  let sig = '';
  let stopFx: (() => void) | null = null;

  const names = (ids: string[], byId: Map<string, IPlayer>): string =>
    ids
      .map((id) => byId.get(id)?.nick ?? '')
      .filter(Boolean)
      .join(', ');

  function renderBars(state: WhoOfUsPublicState, tally: Map<string, number>): void {
    clear(bars);
    const players = playersOf(state);
    const max = Math.max(1, ...tally.values());
    const leaders = new Set(listOf(state.leaders));
    const order = [...players].sort((a, b) => (tally.get(a.id) ?? 0) - (tally.get(b.id) ?? 0));
    const step = (BARS_MS - BAR_ANIM_MS) / Math.max(1, order.length);
    const delays = new Map(order.map((p, i) => [p.id, Math.round(i * step)]));
    for (const p of players) {
      const n = tally.get(p.id) ?? 0;
      const fill = h('div', { class: 'wou-bar__fill' });
      fill.style.height = `${(n / max) * 100}%`;
      const col = h('div', { class: `wou-bar${leaders.has(p.id) ? ' wou-bar--lead' : ''}` }, [
        h('div', { class: 'wou-bar__count' }, String(n)),
        h('div', { class: 'wou-bar__track' }, fill),
        avatarEl(p),
        h('div', { class: 'wou-bar__nick' }, p.nick),
      ]);
      col.style.setProperty('--d', `${delays.get(p.id) ?? 0}ms`);
      bars.append(col);
    }
  }

  function renderOutcome(state: WhoOfUsPublicState, byId: Map<string, IPlayer>): void {
    const leaders = listOf(state.leaders);
    const correct = listOf(state.correct);
    clear(verdict);
    if (leaders.length === 0) {
      verdict.append(h('div', { class: 'wou-verdict__line' }, t('whoOfUs.noVotes')));
    } else {
      const lead = h('div', { class: 'wou-verdict__lead' });
      for (const id of leaders) {
        const p = byId.get(id);
        if (p) lead.append(h('div', { class: 'wou-lead' }, [avatarEl(p), p.nick]));
      }
      verdict.append(
        h('div', { class: 'wou-verdict__line' }, t('whoOfUs.leader', { count: leaders.length })),
        lead,
      );
    }
    guessed.textContent =
      leaders.length === 0
        ? ''
        : correct.length > 0
          ? t('whoOfUs.guessed', { points: GUESS_POINTS, names: names(correct, byId) })
          : t('whoOfUs.nobodyGuessed');
    titles.textContent = '';
    if (state.round >= state.totalRounds) {
      const counts = readCounts(state.leaderCount);
      const top = Math.max(0, ...counts.values());
      if (top > 0) {
        const ids = [...counts].filter(([, n]) => n === top).map(([id]) => id);
        titles.textContent = t('whoOfUs.mostOften', { names: names(ids, byId), count: top });
      }
    }
  }

  return {
    update(state) {
      const tally = readCounts(state.tally);
      const s = `${state.round}|${state.questionId}|${[...tally].join(';')}|${listOf(state.leaders).join(',')}|${listOf(state.correct).join(',')}`;
      if (s === sig) return;
      sig = s;
      question.textContent = questionText(state.questionId);
      const byId = new Map(playersOf(state).map((p) => [p.id, p]));
      renderBars(state, tally);
      renderOutcome(state, byId);
      stopFx?.();
      stopFx = playEffect(ctx.cosmetics().effect, fx, BARS_MS);
    },
    destroy() {
      stopFx?.();
      root.remove();
    },
  };
}
