import type { PlatformAdapter, Purchase, PurchaseResult } from '@party/platform';
import type { Entitlements, MonetizationConfig, ProductDef } from './contracts.js';
import type { Tracker } from './adManager.js';

export interface ShopItem extends ProductDef {
  /** Цена от площадки; null — нет в каталоге площадки. */
  priceText: string | null;
  owned: boolean;
}

export type ShopStorage = Pick<PlatformAdapter, 'saveData' | 'loadData'>;

export interface ShopOptions {
  adapter: PlatformAdapter;
  config: MonetizationConfig;
  catalog: ProductDef[];
  tracker: Tracker;
  storage: ShopStorage;
}

export interface Shop {
  list(): Promise<ShopItem[]>;
  buy(productId: string): Promise<boolean>;
  refresh(): Promise<Entitlements>;
  entitlements(): Entitlements;
  grantReward(productId: string): Promise<void>;
}

const REWARDS_KEY = 'rewards';

export function createShop(opts: ShopOptions): Shop {
  const { adapter, catalog, tracker, storage } = opts;
  let purchased: Purchase[] = [];
  const rewards = new Set<string>();

  function compute(): Entitlements {
    const ent: Entitlements = { noAds: false, cosmetics: new Set(), packs: new Set() };
    const ids = new Set<string>([...purchased.map((p) => p.productId), ...rewards]);
    for (const def of catalog) {
      if (!ids.has(def.id)) continue;
      if (def.kind === 'no_ads') ent.noAds = true;
      else if (def.kind === 'cosmetic') ent.cosmetics.add(def.id);
      else if (def.pack) ent.packs.add(`${def.pack.game}/${def.pack.packId}`);
    }
    return ent;
  }

  let current = compute();

  async function refresh(): Promise<Entitlements> {
    try {
      purchased = await adapter.getPurchases();
    } catch {
      purchased = [];
    }
    try {
      const saved = await storage.loadData<string[]>(REWARDS_KEY);
      rewards.clear();
      if (Array.isArray(saved)) {
        for (const id of saved) if (typeof id === 'string') rewards.add(id);
      }
    } catch {
      // оставляем уже известные награды
    }
    current = compute();
    return current;
  }

  function isOwned(def: ProductDef): boolean {
    if (def.kind === 'no_ads') return current.noAds;
    if (def.kind === 'cosmetic') return current.cosmetics.has(def.id);
    return def.pack ? current.packs.has(`${def.pack.game}/${def.pack.packId}`) : false;
  }

  async function list(): Promise<ShopItem[]> {
    let prices: Map<string, string>;
    try {
      prices = new Map((await adapter.getCatalog()).map((c) => [c.productId, c.priceText]));
    } catch {
      prices = new Map();
    }
    return catalog.map((def) => ({
      ...def,
      priceText: prices.get(def.id) ?? null,
      owned: isOwned(def),
    }));
  }

  async function buy(productId: string): Promise<boolean> {
    if (!opts.config[adapter.id].purchasesEnabled) return false;
    if (!catalog.some((d) => d.id === productId)) return false;
    let result: PurchaseResult;
    try {
      result = await adapter.purchase(productId);
    } catch {
      return false;
    }
    if (!result.ok) return false;
    purchased = [...purchased.filter((p) => p.productId !== productId), result.purchase];
    current = compute();
    tracker.track('purchase', { productId, platform: adapter.id });
    return true;
  }

  async function grantReward(productId: string): Promise<void> {
    rewards.add(productId);
    current = compute();
    await storage.saveData(REWARDS_KEY, [...rewards]);
  }

  return { list, buy, refresh, entitlements: () => current, grantReward };
}
