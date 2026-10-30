import { clear, h, type Component } from '@party/ui';
import { MSG_VOTE } from '../shared/messages.js';
import type { SpyPublicState } from '../shared/types.js';
import { connectedIds, listOf, nickOf, playerButton, playersOf, type SpyCtx } from './util.js';

export interface VotePanel extends Component {
  update(state: SpyPublicState): void;
}

/** Голосование: сетка игроков (кроме себя), свой выбор подсвечен и его можно изменить. */
export function createVotePanel(ctx: SpyCtx): VotePanel {
  const { t, me } = ctx;
  const title = h('div', { class: 'spy-vote__title' }, t('spy.vote.title'));
  const grid = h('div', { class: 'spy-vote__grid' });
  const mineEl = h('div', { class: 'spy-vote__mine' });
  const status = h('div', { class: 'spy-vote__status' });
  const el = h('div', { class: 'spy-vote' }, [title, grid, mineEl, status]);

  let mine = '';
  let last: SpyPublicState | null = null;
  let sig = '';

  function choose(id: string): void {
    mine = id;
    ctx.client.sendGame(MSG_VOTE, { targetId: id });
    if (last) render(last);
  }

  function render(state: SpyPublicState): void {
    const players = playersOf(state);
    const next = `${mine}|${players.map((p) => `${p.id}:${p.nick}:${p.connected}`).join(',')}`;
    if (next !== sig) {
      sig = next;
      clear(grid);
      for (const p of players) {
        if (p.id === me) continue;
        grid.append(playerButton(p, { picked: p.id === mine, onClick: () => choose(p.id) }));
      }
    }
    const connected = connectedIds(state);
    const voted = listOf(state.voted).filter((id) => connected.has(id)).length;
    mineEl.textContent = mine ? t('spy.vote.mine', { name: nickOf(state, mine) }) : '';
    mineEl.hidden = mine === '';
    status.textContent = t('spy.vote.voted', { done: voted, total: connected.size });
  }

  return {
    el,
    update(state) {
      last = state;
      render(state);
    },
    destroy: () => el.remove(),
  };
}
