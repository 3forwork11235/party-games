import type {
  AdStatus,
  PlatformAdapter,
  PlatformId,
  Purchase,
  PurchaseResult,
  RewardedResult,
} from '@party/platform';
import type { Tracker } from '../src/adManager.js';

export interface MockAdapter extends PlatformAdapter {
  calls: string[];
  store: Map<string, unknown>;
  purchases: Purchase[];
  interstitialStatus: AdStatus;
  rewardedResult: RewardedResult;
  purchaseResult: PurchaseResult | null;
}

export function mockAdapter(id: PlatformId = 'yandex'): MockAdapter {
  const m: MockAdapter = {
    id,
    calls: [],
    store: new Map(),
    purchases: [],
    interstitialStatus: 'shown',
    rewardedResult: { rewarded: true, status: 'shown' },
    purchaseResult: null,
    init: async () => {},
    gameReady: () => {},
    gameplayStart: () => void m.calls.push('start'),
    gameplayStop: () => void m.calls.push('stop'),
    getPlayer: async () => ({ id: null, name: null, avatarUrl: null, isAuthorized: false }),
    getLanguage: () => 'ru',
    getLaunchParams: () => ({ roomCode: null }),
    buildInviteUrl: (c) => `https://x/?room=${c}`,
    showInterstitial: async () => {
      m.calls.push('interstitial');
      return m.interstitialStatus;
    },
    showRewarded: async () => {
      m.calls.push('rewarded');
      return m.rewardedResult;
    },
    getCatalog: async () => [{ productId: 'no_ads', title: 'No ads', priceText: '99 ₽' }],
    purchase: async (productId) =>
      m.purchaseResult ?? { ok: true, purchase: { productId, purchaseToken: `t_${productId}` } },
    getPurchases: async () => m.purchases,
    share: async () => true,
    saveData: async (k, v) => void m.store.set(k, v),
    loadData: async <T>(k: string) => (m.store.has(k) ? (m.store.get(k) as T) : null),
    analytics: () => {},
  };
  return m;
}

export function mockTracker(): Tracker & { events: Array<[string, unknown]> } {
  const events: Array<[string, unknown]> = [];
  return { events, track: (name, params) => void events.push([name, params]) };
}
