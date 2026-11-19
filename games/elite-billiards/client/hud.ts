import { h } from '@party/ui';
import { PENALTY_NO_HIT, PENALTY_SCRATCH, PENALTY_TIMEOUT } from '../shared/config.js';
import type { EliteBilliardsPublicState } from '../shared/types.js';
import type { BilliardsCtx } from './types.js';

const FOUL_PENALTY: Record<string, number> = {
  scratch: PENALTY_SCRATCH,
  noHit: PENALTY_NO_HIT,
  timeout: PENALTY_TIMEOUT,
};

export interface Hud {
  el: HTMLElement;
  update(state: EliteBilliardsPublicState): void;
  setHint(text: string): void;
  tick(): void;
  destroy(): void;
}

/** Верхняя панель: чей ход, очки раскладки, итог прошлого удара, осталось шаров, таймер. */
export function createHud(ctx: BilliardsCtx): Hud {
  const { t, me } = ctx;
  const turn = h('div', { class: 'eb-hud__turn' });
  const timer = h('div', { class: 'eb-hud__timer' });
  const scores = h('div', { class: 'eb-hud__scores' });
  const last = h('div', { class: 'eb-hud__last' });
  const left = h('div', { class: 'eb-hud__left' });
  const hintEl = h('div', { class: 'eb-hud__hint' });
  const banner = h('div', { class: 'eb-banner', hidden: true });
  const top = h('div', { class: 'eb-hud__row' }, [turn, timer]);
  const mid = h('div', { class: 'eb-hud__row eb-hud__row--sub' }, [last, left]);
  const el = h('div', { class: 'eb-hud' }, [top, scores, mid, hintEl, banner]);
  let timerEnd = 0;
  let timerShown = -1;

  const nick = (state: EliteBilliardsPublicState, id: string): string =>
    state.players.get(id)?.nick ?? '?';

  const lastText = (s: EliteBilliardsPublicState): string => {
    if (!s.lastShooterId) return '';
    const who = s.lastShooterId === me ? t('billiards.you') : nick(s, s.lastShooterId);
    if (s.lastFoul) {
      const n = Math.abs(s.lastPoints) || FOUL_PENALTY[s.lastFoul] || 0;
      return `${who}: ${t(`billiards.foul.${s.lastFoul}`, { n })}`;
    }
    if (s.lastPoints > 0) return `${who}: +${s.lastPoints}`;
    return `${who}: ${t('billiards.noPoints')}`;
  };

  return {
    el,
    setHint(text) {
      hintEl.textContent = text;
      hintEl.hidden = text === '';
    },
    update(s) {
      const inRound = s.phase === 'round';
      const shooter = s.players.get(s.shooterId);
      if (inRound && shooter) {
        turn.textContent =
          s.shooterId === me
            ? t('billiards.yourShot')
            : t('billiards.turnOf', { nick: `${shooter.avatar} ${shooter.nick}` });
        turn.classList.toggle('eb-hud__turn--me', s.shooterId === me);
      } else {
        turn.textContent = '';
      }
      scores.replaceChildren(
        ...s.order
          .filter((id) => s.players.has(id))
          .map((id) => {
            const pts = s.rackScore.get(id) ?? 0;
            const p = s.players.get(id);
            return h(
              'span',
              {
                class: `eb-chip${id === s.shooterId && inRound ? ' eb-chip--active' : ''}${p?.connected === false ? ' eb-chip--off' : ''}`,
              },
              `${p?.avatar ?? ''} ${id === me ? t('billiards.you') : (p?.nick ?? '')} ${pts}`,
            );
          }),
      );
      last.textContent = inRound ? lastText(s) : '';
      const alive = s.balls.filter((b) => !b.potted && b.id !== 0).length;
      left.textContent = inRound ? t('billiards.left', { n: alive }) : '';
      banner.hidden = s.phase !== 'countdown';
      if (s.phase === 'countdown') banner.textContent = t('billiards.rack', { n: s.round });
      timerEnd = inRound && s.stage === 'aim' ? s.phaseEndsAt : 0;
      timerShown = -1;
      this.tick();
    },
    tick() {
      const sec = timerEnd > 0 ? Math.max(0, Math.ceil((timerEnd - ctx.client.serverNow()) / 1000)) : -1;
      if (sec === timerShown) return;
      timerShown = sec;
      timer.textContent = sec >= 0 ? String(sec) : '';
      timer.classList.toggle('eb-hud__timer--low', sec >= 0 && sec <= 5);
    },
    destroy() {
      el.remove();
    },
  };
}
