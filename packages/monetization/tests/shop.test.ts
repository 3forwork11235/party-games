import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../src/catalog.js';
import { DEFAULT_MONETIZATION_CONFIG } from '../src/config.js';
import { createShop } from '../src/shop.js';
import { mockAdapter, mockTracker } from './helpers.js';

function setup(platform: 'yandex' | 'capacitor' = 'yandex') {
  const adapter = mockAdapter(platform);
  const tracker = mockTracker();
  const shop = createShop({
    adapter,
    config: DEFAULT_MONETIZATION_CONFIG,
    catalog: DEFAULT_CATALOG,
    tracker,
    storage: adapter,
  });
  return { adapter, tracker, shop };
}

describe('shop', () => {
  it('computes entitlements from purchases on refresh', async () => {
    const { adapter, shop } = setup();
    adapter.purchases = [
      { productId: 'no_ads', purchaseToken: 'a' },
      { productId: 'avatar_alien', purchaseToken: 'b' },
      { productId: 'pack_example', purchaseToken: 'c' },
      { productId: 'unknown', purchaseToken: 'd' },
    ];
    const ent = await shop.refresh();
    expect(ent.noAds).toBe(true);
    expect([...ent.cosmetics]).toEqual(['avatar_alien']);
    expect([...ent.packs]).toEqual(['example/extra']);
  });

  it('buy tracks purchase and updates entitlements', async () => {
    const { shop, tracker } = setup();
    expect(await shop.buy('no_ads')).toBe(true);
    expect(shop.entitlements().noAds).toBe(true);
    expect(tracker.events).toEqual([['purchase', { productId: 'no_ads', platform: 'yandex' }]]);
  });

  it('buy fails on cancel, disabled platform and unknown product', async () => {
    const a = setup();
    a.adapter.purchaseResult = { ok: false, reason: 'cancelled' };
    expect(await a.shop.buy('no_ads')).toBe(false);
    expect(a.tracker.events).toEqual([]);
    expect(await a.shop.buy('nope')).toBe(false);
    const b = setup('capacitor');
    expect(await b.shop.buy('no_ads')).toBe(false);
  });

  it('list merges platform prices and owned flag', async () => {
    const { shop } = setup();
    await shop.buy('no_ads');
    const items = await shop.list();
    expect(items.find((i) => i.id === 'no_ads')).toMatchObject({ priceText: '99 ₽', owned: true });
    expect(items.find((i) => i.id === 'avatar_alien')).toMatchObject({
      priceText: null,
      owned: false,
    });
  });

  it('rewards persist via saveData and restore on refresh', async () => {
    const { adapter, shop } = setup();
    await shop.grantReward('frame_gold');
    expect(adapter.store.get('rewards')).toEqual(['frame_gold']);
    expect(shop.entitlements().cosmetics.has('frame_gold')).toBe(true);
    const other = createShop({
      adapter,
      config: DEFAULT_MONETIZATION_CONFIG,
      catalog: DEFAULT_CATALOG,
      tracker: mockTracker(),
      storage: adapter,
    });
    expect((await other.refresh()).cosmetics.has('frame_gold')).toBe(true);
  });
});

describe('catalog', () => {
  it('has the required composition and star prices', () => {
    const count = (c: string) => DEFAULT_CATALOG.filter((p) => p.category === c).length;
    expect([count('avatar'), count('frame'), count('nickColor'), count('effect')]).toEqual([
      4, 3, 3, 2,
    ]);
    expect(DEFAULT_CATALOG.every((p) => (p.starsPrice ?? 0) > 0)).toBe(true);
    expect(new Set(DEFAULT_CATALOG.map((p) => p.id)).size).toBe(DEFAULT_CATALOG.length);
  });
});
