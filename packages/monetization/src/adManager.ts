import type { AdStatus, PlatformAdapter } from '@party/platform';
import type { AnalyticsEventMap, AnalyticsEventName } from '@party/analytics';
import type { Entitlements, MonetizationConfig } from './contracts.js';

/** Структурный тип трекера (реализация — в @party/analytics). */
export interface Tracker {
  track<K extends AnalyticsEventName>(name: K, params: AnalyticsEventMap[K]): void;
}

export interface AdManagerOptions {
  adapter: PlatformAdapter;
  config: MonetizationConfig;
  tracker: Tracker;
  entitlements: () => Entitlements;
  now?: () => number;
  onPause?: () => void;
  onResume?: () => void;
}

export interface AdManager {
  onRoundBreak(placement: string): Promise<AdStatus | 'skipped'>;
  showRewarded(placement: string): Promise<boolean>;
  canShowRewarded(): boolean;
}

export function createAdManager(opts: AdManagerOptions): AdManager {
  const { adapter, tracker } = opts;
  const now = opts.now ?? Date.now;
  const createdAt = now();
  let lastShownAt: number | null = null;
  let breakCount = 0;
  let rewardedCount = 0;

  const rules = () => opts.config[adapter.id];

  async function withPause<T>(run: () => Promise<T>): Promise<T> {
    opts.onPause?.();
    adapter.gameplayStop();
    try {
      return await run();
    } finally {
      adapter.gameplayStart();
      opts.onResume?.();
    }
  }

  function canShowRewarded(): boolean {
    const r = rules().rewarded;
    return r.enabled && rewardedCount < r.maxPerSession;
  }

  async function onRoundBreak(placement: string): Promise<AdStatus | 'skipped'> {
    const rule = rules().interstitial;
    breakCount += 1;
    if (!rule.enabled || opts.entitlements().noAds) return 'skipped';
    const t = now();
    if (t - createdAt < rule.firstAfterSec * 1000) return 'skipped';
    if (lastShownAt !== null && t - lastShownAt < rule.minIntervalSec * 1000) return 'skipped';
    if (breakCount % Math.max(1, rule.everyNthBreak) !== 0) return 'skipped';

    let status: AdStatus;
    try {
      status = await withPause(() => adapter.showInterstitial());
    } catch {
      status = 'error';
    }
    if (status === 'shown') {
      lastShownAt = now();
      tracker.track('ad_shown', { type: 'interstitial', placement });
    }
    return status;
  }

  async function showRewarded(placement: string): Promise<boolean> {
    if (!canShowRewarded()) return false;
    let rewarded: boolean;
    try {
      const res = await withPause(() => adapter.showRewarded());
      rewarded = res.rewarded;
    } catch {
      rewarded = false;
    }
    if (rewarded) {
      rewardedCount += 1;
      lastShownAt = now();
      tracker.track('ad_rewarded', { placement });
    }
    return rewarded;
  }

  return { onRoundBreak, showRewarded, canShowRewarded };
}
