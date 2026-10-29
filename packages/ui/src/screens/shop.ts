import { clear, h } from '../dom.js';
import type { Component, TFunction } from '../types.js';

export interface ShopItem {
  id: string;
  title: string;
  priceText: string;
  owned: boolean;
  preview?: string;
}

export interface ShopProps {
  t: TFunction;
  items: ShopItem[];
  onBuy(id: string): void;
  onRewarded?(): void;
  onClose?(): void;
}

export interface ShopScreen extends Component {
  update(items: ShopItem[]): void;
}

export function createShopScreen(props: ShopProps): ShopScreen {
  const { t } = props;
  const grid = h('div', { class: 'p-shop' });
  function update(items: ShopItem[]): void {
    clear(grid);
    for (const it of items) {
      grid.append(
        h('div', { class: 'p-card p-item' }, [
          h('div', { style: 'font-size:2rem' }, it.preview ?? ''),
          h('div', {}, it.title),
          it.owned
            ? h('div', { class: 'p-ready' }, t('ui.shop.owned'))
            : h(
                'button',
                { class: 'p-btn p-btn--primary', type: 'button', onClick: () => props.onBuy(it.id) },
                `${t('ui.shop.buy')} · ${it.priceText}`,
              ),
        ]),
      );
    }
  }
  update(props.items);
  const el = h('div', { class: 'p-screen p-shop-screen' }, [
    h('h1', { class: 'p-title' }, t('ui.shop.title')),
    grid,
    props.onRewarded
      ? h(
          'button',
          { class: 'p-btn', type: 'button', onClick: () => props.onRewarded?.() },
          t('ui.shop.watchAd'),
        )
      : null,
    props.onClose
      ? h(
          'button',
          { class: 'p-btn', type: 'button', onClick: () => props.onClose?.() },
          t('ui.shop.close'),
        )
      : null,
  ]);
  return { el, update, destroy: () => el.remove() };
}
