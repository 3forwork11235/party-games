import { AVATARS } from '@party/core/shared';
import { h } from '@party/ui';
import { MSG_ADD_GUEST, type AddGuestMessage } from '../shared/messages.js';
import type { EliteBilliardsPublicState } from '../shared/types.js';
import type { BilliardsCtx } from './types.js';

const AVATAR_COUNT = 6;

export interface Hotseat {
  el: HTMLElement;
  update(state: EliteBilliardsPublicState): void;
}

/** Лобби: «Играть вдвоём на этом устройстве» — имя, аватар, кнопка и список моих гостей. */
export function createHotseat(ctx: BilliardsCtx): Hotseat {
  const { t, me } = ctx;
  const avatars = AVATARS.slice(0, AVATAR_COUNT);
  let avatar = avatars[0] ?? '';
  /** Пока игрок не выбрал сам — предлагаем аватар, которого ещё нет за столом. */
  let picked = false;
  const input = h('input', {
    type: 'text',
    class: 'eb-hotseat__nick',
    maxlength: '16',
    placeholder: t('billiards.hotseat.nick'),
    'aria-label': t('billiards.hotseat.nick'),
  });
  const buttons = avatars.map((a) => {
    const b = h('button', { type: 'button', class: 'eb-hotseat__avatar' }, a);
    b.addEventListener('click', () => {
      avatar = a;
      picked = true;
      mark();
    });
    return { a, b };
  });
  function mark(): void {
    for (const { a, b } of buttons) b.classList.toggle('eb-hotseat__avatar--on', a === avatar);
  }
  mark();
  const add = h(
    'button',
    { type: 'button', class: 'eb-btn eb-btn--small' },
    t('billiards.hotseat.add'),
  );
  add.addEventListener('click', () => {
    const msg: AddGuestMessage = { nick: input.value.trim(), avatar };
    ctx.client.sendGame(MSG_ADD_GUEST, msg);
    input.value = '';
  });
  const list = h('div', { class: 'eb-hotseat__list' });
  const el = h('div', { class: 'eb-hotseat' }, [
    h('div', { class: 'eb-lobby__title' }, t('billiards.hotseat.title')),
    h('div', { class: 'eb-lobby__hint' }, t('billiards.hotseat.hint')),
    h('div', { class: 'eb-hotseat__form' }, [
      input,
      h(
        'div',
        { class: 'eb-hotseat__avatars' },
        buttons.map((x) => x.b),
      ),
      add,
    ]),
    list,
  ]);
  return {
    el,
    update(s) {
      if (!picked) {
        const used = new Set(Array.from(s.players.values(), (p) => p.avatar));
        avatar = avatars.find((a) => !used.has(a)) ?? avatar;
        mark();
      }
      const mine: string[] = [];
      s.guests.forEach((owner, id) => {
        const p = s.players.get(id);
        if (owner === me && p) mine.push(`${p.avatar} ${p.nick}`);
      });
      list.textContent = mine.length ? `${t('billiards.hotseat.mine')}: ${mine.join(', ')}` : '';
      list.hidden = mine.length === 0;
    },
  };
}
