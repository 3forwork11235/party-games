import { h, type Component } from '@party/ui';
import { HINT_PLACEMENT } from '../shared/catalog.js';
import { MAX_HINTS } from '../shared/config.js';
import { MSG_CALL_VOTE, MSG_HINT, type SpyRoleMessage } from '../shared/messages.js';
import type { SpyPublicState } from '../shared/types.js';
import type { GuessFlow } from './guess.js';
import { connectedIds, listOf, type SpyCtx } from './util.js';

/** Если сервер не ответил на подсказку, кнопка снова становится доступной. */
const HINT_RESET_MS = 3000;

export interface Actions extends Component {
  update(state: SpyPublicState, role: SpyRoleMessage | null): void;
}

/** Сколько голосов «Голосовать» нужно для досрочного голосования (строго больше половины). */
export function votesNeeded(connected: number): number {
  return Math.floor(connected / 2) + 1;
}

/** Кнопки: «Назвать локацию» и «Подсказка» (шпиону), «Голосовать k/n» (всем в обсуждении). */
export function createActions(ctx: SpyCtx, guess: GuessFlow, onChange: () => void): Actions {
  const { t, me } = ctx;
  const guessBtn = h('button', { type: 'button', class: 'p-btn spy-act' });
  const hintBtn = h('button', { type: 'button', class: 'p-btn spy-act' });
  const voteBtn = h('button', { type: 'button', class: 'p-btn spy-act spy-act--vote' });
  const el = h('div', { class: 'spy-actions' }, [guessBtn, hintBtn, voteBtn]);

  let hintsLeft = 0;
  /** hintsLeft на момент отправки, пока сервер не подтвердил. */
  let pending: number | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let myCall = false;

  const clearPending = (): void => {
    if (pendingTimer !== undefined) clearTimeout(pendingTimer);
    pendingTimer = undefined;
    pending = null;
  };

  guessBtn.addEventListener('click', () => (guess.picking ? guess.cancel() : guess.start()));

  hintBtn.addEventListener('click', () => {
    if (pending !== null || busy || hintsLeft <= 0) return;
    const send = (): void => {
      pending = hintsLeft;
      pendingTimer = setTimeout(() => {
        clearPending();
        onChange();
      }, HINT_RESET_MS);
      ctx.client.sendGame(MSG_HINT, {});
      onChange();
    };
    if (hintsLeft >= MAX_HINTS) {
      send();
      return;
    }
    busy = true;
    onChange();
    void ctx.ads
      .showRewarded(HINT_PLACEMENT)
      .then((ok) => {
        if (ok) send();
      })
      .finally(() => {
        busy = false;
        onChange();
      });
  });

  voteBtn.addEventListener('click', () => ctx.client.sendGame(MSG_CALL_VOTE, { on: !myCall }));

  return {
    el,
    update(state, role) {
      const stage = state.stage;
      const spy = role?.spy === true;
      hintsLeft = role?.hintsLeft ?? 0;
      if (pending !== null && hintsLeft !== pending) clearPending();

      guessBtn.hidden = !(spy && stage === 'discussion' && !guess.sent);
      guessBtn.textContent = guess.picking ? t('spy.actions.cancel') : t('spy.actions.guess');

      const live = stage === 'discussion' || stage === 'voting' || stage === 'lastChance';
      const free = hintsLeft >= MAX_HINTS;
      hintBtn.hidden = !(spy && live && hintsLeft > 0 && (free || ctx.ads.canShowRewarded()));
      hintBtn.disabled = pending !== null || busy;
      hintBtn.textContent = free ? t('spy.actions.hint') : t('spy.actions.hintAd');

      const connected = connectedIds(state);
      const calls = listOf(state.voteCalls);
      myCall = calls.includes(me);
      const done = calls.filter((id) => connected.has(id)).length;
      voteBtn.hidden = stage !== 'discussion';
      voteBtn.textContent = t('spy.actions.callVote', {
        done,
        need: votesNeeded(connected.size),
      });
      voteBtn.setAttribute('aria-pressed', myCall ? 'true' : 'false');
      voteBtn.classList.toggle('spy-act--on', myCall);

      el.hidden = guessBtn.hidden && hintBtn.hidden && voteBtn.hidden;
    },
    destroy() {
      clearPending();
      el.remove();
    },
  };
}
