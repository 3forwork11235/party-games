import { clear, h } from '@party/ui';
import type { GameContext, GameView } from '@party/ui/app-shell';
import { SLUG } from '../shared/config.js';
import { ownedPacks } from '../shared/catalog.js';
import { MSG_PACKS } from '../shared/messages.js';
import { PACKS, type PackId } from '../shared/packs.js';
import type { WhoOfUsPublicState } from '../shared/types.js';
import { resetSkipFlag } from './game.js';
import { listOf } from './util.js';

/** Блок паков в лобби: хост выбирает, остальные видят выбранное. */
export function mountLobby(
  container: HTMLElement,
  ctx: GameContext<WhoOfUsPublicState>,
): GameView<WhoOfUsPublicState> {
  const { t, me } = ctx;
  resetSkipFlag();
  const title = h('div', { class: 'wou-packs__title' }, t('whoOfUs.packs'));
  const list = h('div', { class: 'wou-packs__list' });
  const root = h('div', { class: 'wou-packs' }, [title, list]);
  container.append(root);

  let last: WhoOfUsPublicState | null = null;
  let selected = new Set<string>();
  let sig = '';

  const send = (next: Set<string>): void => {
    selected = next;
    ctx.client.sendGame(MSG_PACKS, { packIds: [...next] });
    if (last) render(last);
  };

  const toggle = (id: PackId, paid: boolean): void => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
      ctx.track('pack_selected', { game: SLUG, packId: id, paid });
    }
    send(next);
  };

  function render(state: WhoOfUsPublicState): void {
    const isHost = state.hostId === me;
    const owned = ownedPacks(ctx.entitlements());
    clear(list);
    for (const p of PACKS) {
      const has = owned.has(p.id);
      const on = selected.has(p.id);
      if (!isHost) {
        if (on) list.append(h('div', { class: 'wou-pack wou-pack--on' }, packName(p.id)));
        continue;
      }
      const row = h('div', { class: `wou-pack${on ? ' wou-pack--on' : ''}` });
      const label = h('label', { class: 'wou-pack__label' });
      const box = h('input', { type: 'checkbox', disabled: !has });
      box.checked = on && has;
      box.addEventListener('change', () => toggle(p.id, !p.free));
      label.append(box, h('span', { class: 'wou-pack__name' }, packName(p.id)));
      row.append(label);
      if (!has) {
        row.append(
          h('span', { class: 'wou-pack__lock', 'aria-hidden': 'true' }, '🔒'),
          h(
            'button',
            {
              type: 'button',
              class: 'p-btn wou-pack__buy',
              onClick: () => ctx.openShop(() => last && render(last)),
            },
            t('ui.shop.buy'),
          ),
        );
      }
      list.append(row);
    }
  }

  const packName = (id: string): string => t(`whoOfUs.pack.${id}`);

  return {
    update(state) {
      last = state;
      const server = listOf(state.packs);
      const next = `${server.join(',')}|${state.hostId === me}`;
      if (next !== sig) {
        sig = next;
        selected = new Set(server);
      }
      render(state);
    },
    destroy() {
      root.remove();
    },
  };
}
