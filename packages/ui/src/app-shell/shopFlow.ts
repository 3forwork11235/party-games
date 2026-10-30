import type { AdManager, PlatformMonetizationConfig, ProductDef, Shop } from '@party/monetization';
import type { TFunction } from '../types.js';
import { h } from '../dom.js';
import { createShopScreen, type ShopItem as ViewItem } from '../screens/shop.js';
import { openModal } from '../widgets/modal.js';
import { showToast } from '../widgets/toast.js';
import { pickRewardProduct, type CosmeticsStore } from './cosmetics.js';

export interface ShopFlowDeps {
  t: TFunction;
  shop: Shop;
  adManager: AdManager;
  catalog: readonly ProductDef[];
  /** Конфиг текущей площадки (purchasesEnabled). */
  config: PlatformMonetizationConfig;
  cosmetics: CosmeticsStore;
}

export interface ShopFlow {
  /** Есть ли что показывать в магазине (покупки или rewarded). */
  available(): boolean;
  /** Открывает магазин модально поверх текущего экрана. onClose — после закрытия. */
  open(onClose?: () => void): Promise<void>;
  /** Добавляет в контейнер кнопку «Магазин» (если магазин доступен). */
  addButton(parent: HTMLElement, onClose?: () => void): void;
}

const PREVIEW: Record<string, string> = { frame: '🖼️', nickColor: '🎨', effect: '✨', skin: '🃏' };

export function createShopFlow(d: ShopFlowDeps): ShopFlow {
  const { t, shop, adManager, config } = d;

  const available = (): boolean => config.purchasesEnabled || adManager.canShowRewarded();

  async function items(): Promise<ViewItem[]> {
    const list = await shop.list();
    return list
      .filter((it) => config.purchasesEnabled || it.owned)
      .map((it) => ({
        id: it.id,
        title: t(it.titleKey),
        priceText: it.priceText ?? '',
        owned: it.owned,
        preview:
          it.category === 'avatar' ? it.value : it.category ? PREVIEW[it.category] : undefined,
      }));
  }

  async function select(id: string): Promise<void> {
    const def = d.catalog.find((p) => p.id === id);
    if (def?.kind === 'cosmetic') await d.cosmetics.select(def);
  }

  async function open(onClose?: () => void): Promise<void> {
    let screen: ReturnType<typeof createShopScreen> | null = null;
    const refresh = async (): Promise<void> => {
      await shop.refresh().catch(() => undefined);
      screen?.update(await items());
    };
    let modal: { close(): void } | null = null;
    screen = createShopScreen({
      t,
      items: await items().catch(() => []),
      onBuy: (id) => {
        void shop.buy(id).then(async (ok) => {
          if (!ok) return showToast(t('shop.purchase_failed'), 'error');
          await select(id);
          showToast(t('shop.purchase_ok'), 'ok');
          await refresh();
        });
      },
      onRewarded: adManager.canShowRewarded()
        ? () => {
            void (async () => {
              if (!adManager.canShowRewarded())
                return showToast(t('ad.reward_unavailable'), 'info');
              if (!(await adManager.showRewarded('shop_reward'))) {
                return showToast(t('ad.reward_unavailable'), 'info');
              }
              const prize = pickRewardProduct(d.catalog, shop.entitlements());
              if (prize) {
                await shop.grantReward(prize.id);
                await select(prize.id);
              }
              showToast(t('shop.reward_granted'), 'ok');
              await refresh();
            })();
          }
        : undefined,
      onClose: () => modal?.close(),
    });
    modal = openModal({ content: screen.el, onClose });
  }

  return {
    available,
    open,
    addButton(parent, onClose) {
      if (!available()) return;
      parent.append(
        h(
          'button',
          { class: 'p-btn', type: 'button', onClick: () => void open(onClose) },
          t('ui.shop.title'),
        ),
      );
    },
  };
}
