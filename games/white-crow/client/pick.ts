import { clear, h } from '@party/ui';
import type { GameContext } from '@party/ui/app-shell';
import { PEEK_PLACEMENT } from '../shared/catalog.js';
import { MSG_PEEK, MSG_PICK } from '../shared/messages.js';
import type { CrowPublicState } from '../shared/types.js';
import { questionOf } from './questions.js';
import { listOf, numsOf, playerChip, playersOf } from './util.js';
import type { YouTracker } from './you.js';

export interface PickPanel {
  el: HTMLElement;
  update(state: CrowPublicState): void;
  destroy(): void;
}

/** Сетка вариантов, «Выбрали k/n», аватары выбравших, кнопка «Подсмотреть». */
export function createPickPanel(ctx: GameContext<CrowPublicState>, you: YouTracker): PickPanel {
  const { t, me } = ctx;
  const grid = h('div', { class: 'crow-options' });
  const status = h('div', { class: 'crow-status' });
  const who = h('div', { class: 'crow-who' });
  const peekBtn = h('button', { type: 'button', class: 'p-btn crow-peek' }, t('crow.peek'));
  const el = h('div', { class: 'crow-pick' }, [grid, status, who, peekBtn]);

  let last: CrowPublicState | null = null;
  let mine = -1;
  let mineRound = 0;
  let busy = false;
  let gridSig = '';

  const choose = (option: number): void => {
    if (!last || last.phase !== 'round' || option === mine) return;
    mine = option;
    ctx.client.sendGame(MSG_PICK, { option });
    gridSig = '';
    render(last);
  };

  peekBtn.addEventListener('click', () => {
    if (!last || busy) return;
    busy = true;
    peekBtn.hidden = true;
    void ctx.ads
      .showRewarded(PEEK_PLACEMENT)
      .then((ok) => {
        if (ok) ctx.client.sendGame(MSG_PEEK, {});
      })
      .finally(() => {
        busy = false;
        if (last) render(last);
      });
  });

  function render(state: CrowPublicState): void {
    if (mineRound !== state.round) {
      mineRound = state.round;
      mine = -1;
      gridSig = '';
    }
    const info = you.get(state.round);
    const picked = listOf(state.picked);
    const peekers = listOf(state.peekers);
    if (mine < 0 && info && info.option >= 0) mine = info.option;
    const peek = info?.peek ?? [];
    const options = numsOf(state.options);
    const skin = ctx.cosmetics().skin;
    const sig = `${state.questionId}|${options.join(',')}|${mine}|${peek.join(',')}|${skin ?? ''}`;
    if (sig !== gridSig) {
      gridSig = sig;
      const q = questionOf(state.questionId);
      clear(grid);
      grid.className = `crow-options${skin ? ` crow-skin--${skin}` : ''}`;
      options.forEach((idx, pos) => {
        const o = q?.options[idx];
        const children: (HTMLElement | string)[] = [
          h('span', { class: 'crow-option__emoji' }, o?.emoji ?? ''),
          h('span', { class: 'crow-option__label' }, o?.label ?? ''),
        ];
        if (peek.length > 0) {
          children.push(h('span', { class: 'crow-option__badge' }, `👀 ${peek[pos] ?? 0}`));
        }
        grid.append(
          h(
            'button',
            {
              type: 'button',
              class: `crow-option${idx === mine ? ' crow-option--on' : ''}`,
              'aria-pressed': idx === mine ? 'true' : 'false',
              onClick: () => choose(idx),
            },
            children,
          ),
        );
      });
    }
    const players = playersOf(state);
    const total = players.filter((p) => p.connected).length;
    const iPicked = picked.includes(me) || mine >= 0;
    const done = picked.includes(me) ? picked.length : picked.length + (mine >= 0 ? 1 : 0);
    status.textContent = t('crow.picked', { done: Math.min(done, Math.max(total, 1)), total });
    clear(who);
    const byId = new Map(players.map((p) => [p.id, p]));
    for (const id of picked) {
      const p = byId.get(id);
      if (!p) continue;
      who.append(playerChip(p, peekers.includes(id) ? '🔭' : ''));
    }
    if (iPicked && !picked.includes(me)) {
      const self = byId.get(me);
      if (self) who.append(playerChip(self));
    }
    peekBtn.hidden = busy || peekers.includes(me) || !ctx.ads.canShowRewarded();
  }

  return {
    el,
    update(state) {
      last = state;
      render(state);
    },
    destroy() {
      el.remove();
    },
  };
}
