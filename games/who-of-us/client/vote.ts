import { clear, h } from '@party/ui';
import type { GameContext } from '@party/ui/app-shell';
import { MSG_VOTE } from '../shared/messages.js';
import type { WhoOfUsPublicState } from '../shared/types.js';
import { avatarEl, listOf, playersOf } from './util.js';

export interface VotePanel {
  el: HTMLElement;
  update(state: WhoOfUsPublicState): void;
  destroy(): void;
}

type Step = 'target' | 'guess' | 'sent';

/** Два шага выбора (голос → догадка) и ожидание остальных. Сбрасывается при смене вопроса. */
export function createVotePanel(ctx: GameContext<WhoOfUsPublicState>): VotePanel {
  const { t, me } = ctx;
  const heading = h('div', { class: 'wou-step' });
  const grid = h('div', { class: 'wou-grid' });
  const status = h('div', { class: 'wou-status' });
  const el = h('div', { class: 'wou-vote' }, [heading, grid, status]);

  let step: Step = 'target';
  let target = '';
  let key = '';
  let last: WhoOfUsPublicState | null = null;
  let gridSig = '';

  const choose = (id: string): void => {
    if (step === 'target') {
      target = id;
      step = 'guess';
    } else if (step === 'guess') {
      ctx.client.sendGame(MSG_VOTE, { target, guess: id });
      step = 'sent';
    }
    if (last) render(last, true);
  };

  function renderGrid(state: WhoOfUsPublicState): void {
    clear(grid);
    for (const p of playersOf(state)) {
      const mine = step === 'guess' && p.id === target;
      const btn = h(
        'button',
        {
          type: 'button',
          class: `wou-card${mine ? ' wou-card--picked' : ''}`,
          disabled: step === 'sent' || !p.connected,
          onClick: () => choose(p.id),
        },
        [avatarEl(p), h('span', { class: 'wou-nick' }, p.nick)],
      );
      grid.append(btn);
    }
  }

  function render(state: WhoOfUsPublicState, force: boolean): void {
    const voted = listOf(state.voted);
    const iVoted = voted.includes(me);
    if (iVoted && step !== 'sent') step = 'sent';
    const players = playersOf(state);
    const total = players.filter((p) => p.connected).length;
    const done = iVoted ? voted.length : voted.length + (step === 'sent' ? 1 : 0);
    heading.textContent =
      step === 'target'
        ? t('whoOfUs.step1')
        : step === 'guess'
          ? t('whoOfUs.step2')
          : t('whoOfUs.waiting', { done: Math.min(done, total), total });
    status.textContent = t('whoOfUs.voted', { done: Math.min(done, total), total });
    const sig = `${step}|${target}|${players.map((p) => `${p.id}:${p.connected}:${p.frame}`).join(',')}`;
    if (force || sig !== gridSig) {
      gridSig = sig;
      renderGrid(state);
    }
  }

  return {
    el,
    update(state) {
      last = state;
      const k = `${state.round}|${state.questionId}`;
      if (k !== key) {
        key = k;
        step = 'target';
        target = '';
        gridSig = '';
      }
      render(state, false);
    },
    destroy() {
      el.remove();
    },
  };
}
