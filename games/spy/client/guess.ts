import { h, type Component } from '@party/ui';
import { MSG_GUESS, type SpyRoleMessage } from '../shared/messages.js';
import type { SpyPublicState } from '../shared/types.js';
import { locationName } from './locations.js';
import type { SpyCtx } from './util.js';

/** Если сервер не принял догадку, через это время можно выбрать снова. */
const SENT_RESET_MS = 4000;

export interface GuessFlow extends Component {
  /** Режим выбора локации на поле включён (только у шпиона). */
  readonly picking: boolean;
  readonly picked: string;
  /** Догадка уже отправлена. */
  readonly sent: boolean;
  /** Начать выбор в discussion (в lastChance режим включён сам). */
  start(): void;
  cancel(): void;
  pick(id: string): void;
  sync(state: SpyPublicState, role: SpyRoleMessage | null): void;
}

/**
 * Догадка шпиона: выбор на поле → подтверждение → `spy:guess`.
 * `onChange` — просьба перерисовать экран после действия игрока.
 */
export function createGuessFlow(ctx: SpyCtx, onChange: () => void): GuessFlow {
  const { t } = ctx;
  const text = h('div', { class: 'spy-guess__text' });
  const yes = h('button', { type: 'button', class: 'p-btn p-btn--primary' }, t('spy.guess.yes'));
  const no = h('button', { type: 'button', class: 'p-btn' }, t('spy.actions.cancel'));
  const btns = h('div', { class: 'spy-guess__btns' }, [yes, no]);
  const el = h('div', { class: 'spy-guess' }, [text, btns]);

  let started = false;
  let picked = '';
  let sent = false;
  let picking = false;
  let stage = '';
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const stopReset = (): void => {
    if (resetTimer !== undefined) clearTimeout(resetTimer);
    resetTimer = undefined;
  };

  function cancel(): void {
    if (stage === 'lastChance') picked = '';
    else {
      started = false;
      picked = '';
    }
    onChange();
  }

  yes.addEventListener('click', () => {
    if (!picking || picked === '' || sent) return;
    ctx.client.sendGame(MSG_GUESS, { locationId: picked });
    sent = true;
    stopReset();
    resetTimer = setTimeout(() => {
      resetTimer = undefined;
      sent = false;
      onChange();
    }, SENT_RESET_MS);
    onChange();
  });
  no.addEventListener('click', cancel);

  return {
    el,
    get picking() {
      return picking;
    },
    get picked() {
      return picked;
    },
    get sent() {
      return sent;
    },
    start() {
      if (sent) return;
      started = true;
      onChange();
    },
    cancel,
    pick(id) {
      if (!picking || sent) return;
      picked = id;
      onChange();
    },
    sync(state, role) {
      stage = state.stage;
      const spy = role?.spy === true;
      if (stage !== 'discussion') started = false;
      picking = spy && !sent && (stage === 'lastChance' || (stage === 'discussion' && started));
      if (!picking) picked = '';
      el.hidden = !(picking || (spy && sent));
      if (el.hidden) return;
      if (sent) {
        text.textContent = t('spy.guess.sent');
        btns.hidden = true;
        return;
      }
      btns.hidden = false;
      text.textContent =
        picked === ''
          ? t('spy.guess.pick')
          : t('spy.guess.confirm', { name: locationName(picked) });
      yes.disabled = picked === '';
      no.hidden = stage === 'lastChance' && picked === '';
    },
    destroy() {
      stopReset();
      el.remove();
    },
  };
}
