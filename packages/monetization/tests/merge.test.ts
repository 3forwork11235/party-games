import { describe, expect, it } from 'vitest';
import { DEFAULT_MONETIZATION_CONFIG, mergeMonetizationConfig } from '../src/index.js';

describe('mergeMonetizationConfig', () => {
  it('без override возвращает базу', () => {
    expect(mergeMonetizationConfig(DEFAULT_MONETIZATION_CONFIG, undefined)).toEqual(
      DEFAULT_MONETIZATION_CONFIG,
    );
  });

  it('мержит частично и не мутирует базу', () => {
    const snap = structuredClone(DEFAULT_MONETIZATION_CONFIG);
    const r = mergeMonetizationConfig(DEFAULT_MONETIZATION_CONFIG, {
      yandex: { interstitial: { minIntervalSec: 90 }, purchasesEnabled: false },
    });
    expect(r.yandex.interstitial).toEqual({ ...snap.yandex.interstitial, minIntervalSec: 90 });
    expect(r.yandex.rewarded).toEqual(snap.yandex.rewarded);
    expect(r.yandex.purchasesEnabled).toBe(false);
    expect(r.web).toEqual(snap.web);
    expect(DEFAULT_MONETIZATION_CONFIG).toEqual(snap);
  });
});
