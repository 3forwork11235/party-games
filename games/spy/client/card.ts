import { h, type Component } from '@party/ui';
import type { SpyRoleMessage } from '../shared/messages.js';
import { locationEmoji, locationName, roleName } from './locations.js';
import type { SpyCtx } from './util.js';

/** Сколько секунд свёрнутая карточка остаётся открытой после тапа. */
export const PEEK_MS = 3000;

export interface RoleCard extends Component {
  /** big — крупно (стадия roles), иначе свёрнута: тап показывает на PEEK_MS. */
  update(role: SpyRoleMessage | null, big: boolean): void;
}

/** Безопасный суффикс класса скина (id приходит из локального хранилища). */
function skinClass(skin: string | undefined): string {
  return skin && /^[a-z0-9_-]+$/i.test(skin) ? ` spy-card--${skin}` : '';
}

/** Карточка роли: эмодзи, локация и роль либо «Ты шпион»; оформление — скин из косметики. */
export function createRoleCard(ctx: SpyCtx): RoleCard {
  const { t } = ctx;
  const body = h('span', { class: 'spy-card__body' });
  const cover = h('span', { class: 'spy-card__cover' }, [
    h('span', { class: 'spy-card__cover-icon', 'aria-hidden': 'true' }, '🃏'),
    h('span', { class: 'spy-card__cover-text' }, t('spy.card.tap')),
  ]);
  const el = h(
    'button',
    { type: 'button', class: 'spy-card', 'aria-live': 'polite', onClick: () => peekNow() },
    [body, cover],
  );

  let role: SpyRoleMessage | null = null;
  let big = false;
  let peek = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sig = '';

  function stopPeek(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    peek = false;
  }

  function peekNow(): void {
    if (big || peek) return;
    peek = true;
    timer = setTimeout(() => {
      timer = undefined;
      peek = false;
      render();
    }, PEEK_MS);
    render();
  }

  function fill(): void {
    body.textContent = '';
    if (!role) {
      body.append(h('span', { class: 'spy-card__wait' }, t('spy.card.loading')));
    } else if (role.spy) {
      body.append(
        h('span', { class: 'spy-card__emoji' }, '🕵️'),
        h('span', { class: 'spy-card__name' }, t('spy.card.spyTitle')),
        h('span', { class: 'spy-card__role' }, t('spy.card.spyHint')),
      );
    } else {
      const id = role.locationId ?? '';
      body.append(
        h('span', { class: 'spy-card__emoji' }, locationEmoji(id)),
        h('span', { class: 'spy-card__label' }, t('spy.card.location')),
        h('span', { class: 'spy-card__name' }, locationName(id)),
        h('span', { class: 'spy-card__label' }, t('spy.card.role')),
        h('span', { class: 'spy-card__role' }, roleName(id, role.roleIndex ?? 0)),
      );
    }
  }

  function render(): void {
    const open = big || peek;
    const skin = ctx.cosmetics().skin;
    const next = `${role?.round}|${role?.spy}|${role?.locationId}|${role?.roleIndex}|${skin}|${big}|${peek}`;
    if (next === sig) return;
    sig = next;
    el.className = `spy-card${skinClass(skin)}${big ? ' spy-card--big' : ''}${open ? ' spy-card--open' : ''}`;
    el.disabled = big || peek;
    body.hidden = !open;
    cover.hidden = open;
    if (open) fill();
  }

  return {
    el,
    update(nextRole, nextBig) {
      role = nextRole;
      if (nextBig) stopPeek();
      big = nextBig;
      render();
    },
    destroy() {
      stopPeek();
      el.remove();
    },
  };
}
