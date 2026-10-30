import { h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import { MSG_SEEN } from '../shared/messages.js';
import type { SpyPublicState } from '../shared/types.js';
import { createActions } from './actions.js';
import { createBoard } from './board.js';
import { createRoleCard } from './card.js';
import { createGuessFlow } from './guess.js';
import { createRoleTracker } from './role.js';
import { createTurnPanel } from './turn.js';
import { connectedIds, listOf, type SpyCtx } from './util.js';
import { createVotePanel } from './vote.js';

/**
 * Экран игры: countdown → стадии round по `state.stage`
 * (roles → discussion → voting → lastChance). Раскрытие — в reveal.ts.
 */
export function mountGame(container: HTMLElement, ctx: SpyCtx): GameView<SpyPublicState> {
  const { t, me } = ctx;
  let last: SpyPublicState | null = null;
  let raf = 0;
  let seenSent = false;

  const refresh = (): void => {
    if (last) render(last);
  };
  const tracker = createRoleTracker(ctx.client, refresh);
  const card = createRoleCard(ctx);
  const guess = createGuessFlow(ctx, refresh);
  const board = createBoard((id) => guess.pick(id));
  const actions = createActions(ctx, guess, refresh);
  const turn = createTurnPanel(ctx);
  const vote = createVotePanel(ctx);

  const countNum = h('div', { class: 'spy-count__num' });
  const count = h('div', { class: 'spy-count' }, [
    countNum,
    h('div', { class: 'spy-count__text' }, t('spy.dealing')),
  ]);

  const rolesText = h('div', { class: 'spy-roles__text' });
  const seenBtn = h(
    'button',
    {
      type: 'button',
      class: 'p-btn p-btn--primary spy-roles__btn',
      onClick: () => {
        seenSent = true;
        ctx.client.sendGame(MSG_SEEN, {});
        refresh();
      },
    },
    t('spy.roles.seen'),
  );
  const ready = h('div', { class: 'spy-roles__ready' });
  const roles = h('div', { class: 'spy-roles' }, [rolesText, seenBtn, ready]);

  const note = h('div', { class: 'spy-note' });
  const boardBox = h('div', { class: 'spy-boardbox' }, [
    h('div', { class: 'spy-boardbox__title' }, t('spy.board.title')),
    guess.el,
    board.el,
  ]);
  const side = h('div', { class: 'spy-side' }, [card.el]);
  const main = h('div', { class: 'spy-main' }, [
    roles,
    note,
    turn.el,
    vote.el,
    boardBox,
    actions.el,
  ]);
  const root = h('div', { class: 'spy-game' }, [count, side, main]);
  container.append(root);

  const tickCountdown = (): void => {
    if (!last || last.phase !== 'countdown') return;
    const left = Math.max(0, last.phaseEndsAt - ctx.client.serverNow());
    countNum.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    raf = requestAnimationFrame(tickCountdown);
  };

  function renderRoles(state: SpyPublicState, spy: boolean | undefined): void {
    const connected = connectedIds(state);
    const seen = listOf(state.seen);
    rolesText.textContent = spy === undefined ? '' : spy ? t('spy.roles.spy') : t('spy.roles.crew');
    const mineSeen = seenSent || seen.includes(me);
    seenBtn.disabled = mineSeen;
    seenBtn.textContent = mineSeen ? t('spy.roles.seenDone') : t('spy.roles.seen');
    ready.textContent = t('spy.roles.ready', {
      done: seen.filter((id) => connected.has(id)).length,
      total: connected.size,
    });
  }

  function render(state: SpyPublicState): void {
    const inRound = state.phase === 'round';
    const stage = inRound ? state.stage || 'roles' : '';
    const role = tracker.get(state.round);

    count.hidden = state.phase !== 'countdown';
    side.hidden = !inRound;
    main.hidden = !inRound;
    card.update(role, stage === 'roles');

    roles.hidden = stage !== 'roles';
    if (stage === 'roles') renderRoles(state, role?.spy);

    turn.el.hidden = stage !== 'discussion';
    if (stage === 'discussion') turn.update(state);
    vote.el.hidden = stage !== 'voting';
    if (stage === 'voting') vote.update(state);

    note.hidden = stage !== 'lastChance';
    note.textContent = role?.spy ? t('spy.guess.lastChance') : t('spy.guess.waiting');

    boardBox.hidden = !inRound || stage === 'roles';
    guess.sync(state, role);
    board.update({
      ids: listOf(state.board),
      crossed: new Set(role?.crossed ?? []),
      pick: guess.picking,
      picked: guess.picked,
    });
    actions.update(state, role);
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
      for (const part of [card, guess, board, actions, turn, vote]) part.destroy();
      root.remove();
    },
  };
}
