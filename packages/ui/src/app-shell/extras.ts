import { h } from '../dom.js';
import type { TFunction } from '../types.js';
import type { ChatDock } from './chatDock.js';
import type { ShopFlow } from './shopFlow.js';

/** Кнопки «Магазин» / «Выйти» и чат под основным содержимым лобби. */
export function addLobbyExtras(
  el: HTMLElement,
  d: { t: TFunction; chat?: ChatDock; shop?: ShopFlow; onLeave(): void },
): void {
  d.shop?.addButton(el);
  el.append(
    h(
      'button',
      { class: 'p-btn', type: 'button', onClick: () => d.onLeave() },
      d.t('ui.lobby.leave'),
    ),
  );
  d.chat?.mount(el);
}
