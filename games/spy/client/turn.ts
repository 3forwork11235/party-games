import type { IPlayer } from '@party/core/shared';
import { clear, h, type Component } from '@party/ui';
import { MSG_ANSWERED, MSG_ASK, MSG_PASS } from '../shared/messages.js';
import type { SpyPublicState } from '../shared/types.js';
import { nickOf, playerButton, playersOf, type SpyCtx } from './util.js';

export interface TurnPanel extends Component {
  update(state: SpyPublicState): void;
}

/**
 * Кого может спросить `asker`: подключённые, не он сам и не `lastAskerId` (если есть выбор).
 * Те же правила, что на сервере (server/turns.ts) — сервер всё равно перепроверяет.
 */
export function allowedTargets(
  players: readonly IPlayer[],
  asker: string,
  lastAskerId: string,
): string[] {
  const others = players.filter((p) => p.id !== asker && p.connected).map((p) => p.id);
  const fresh = others.filter((id) => id !== lastAskerId);
  return fresh.length > 0 ? fresh : others;
}

/** Очередь вопросов: кто кого спрашивает, выбор цели, «Ответил», «Передать ход». */
export function createTurnPanel(ctx: SpyCtx): TurnPanel {
  const { t, me } = ctx;
  const text = h('div', { class: 'spy-turn__text' });
  const grid = h('div', { class: 'spy-turn__grid' });
  const answered = h(
    'button',
    {
      type: 'button',
      class: 'p-btn p-btn--primary spy-turn__btn',
      onClick: () => ctx.client.sendGame(MSG_ANSWERED, {}),
    },
    t('spy.turn.answered'),
  );
  const pass = h(
    'button',
    {
      type: 'button',
      class: 'p-btn spy-turn__btn',
      onClick: () => ctx.client.sendGame(MSG_PASS, {}),
    },
    t('spy.turn.pass'),
  );
  const count = h('div', { class: 'spy-turn__count' });
  const el = h('div', { class: 'spy-turn' }, [
    text,
    grid,
    h('div', { class: 'spy-turn__btns' }, [answered, pass]),
    count,
  ]);

  let gridSig = '';

  return {
    el,
    update(state) {
      const { askerId, targetId, lastAskerId } = state;
      const players = playersOf(state);
      const iAsk = askerId === me;
      const iTarget = targetId === me;
      const choosing = iAsk && targetId === '';
      el.classList.toggle('spy-turn--me', choosing || iTarget);

      if (targetId === '') {
        text.textContent = iAsk
          ? t('spy.turn.yourTurn')
          : t('spy.turn.picking', { name: nickOf(state, askerId) });
      } else if (iTarget) {
        text.textContent = t('spy.turn.answerMe', { asker: nickOf(state, askerId) });
      } else {
        text.textContent = t('spy.turn.asks', {
          asker: nickOf(state, askerId),
          target: nickOf(state, targetId),
        });
      }

      grid.hidden = !choosing;
      const allowed = new Set(allowedTargets(players, askerId, lastAskerId));
      const sig = choosing
        ? players.map((p) => `${p.id}:${p.nick}:${p.connected}:${allowed.has(p.id)}`).join(',')
        : '';
      if (sig !== gridSig) {
        gridSig = sig;
        clear(grid);
        if (choosing) {
          for (const p of players) {
            if (p.id === me) continue;
            grid.append(
              playerButton(p, {
                disabled: !allowed.has(p.id),
                onClick: () => ctx.client.sendGame(MSG_ASK, { targetId: p.id }),
              }),
            );
          }
        }
      }

      answered.hidden = !iTarget;
      pass.hidden = !(iAsk || state.hostId === me);
      count.textContent = t('spy.turn.questions', { n: state.questions });
    },
    destroy: () => el.remove(),
  };
}
