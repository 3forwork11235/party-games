import { describe, expect, it } from 'vitest';
import { createAdManager } from '../src/adManager.js';
import { DEFAULT_MONETIZATION_CONFIG } from '../src/config.js';
import type { Entitlements, MonetizationConfig } from '../src/contracts.js';
import { mockAdapter, mockTracker } from './helpers.js';

const none = (): Entitlements => ({ noAds: false, cosmetics: new Set(), packs: new Set() });

function setup(over?: { cfg?: MonetizationConfig; ent?: () => Entitlements }) {
  let t = 1_000_000;
  const adapter = mockAdapter('yandex');
  const tracker = mockTracker();
  const log: string[] = [];
  const mgr = createAdManager({
    adapter,
    config: over?.cfg ?? DEFAULT_MONETIZATION_CONFIG,
    tracker,
    entitlements: over?.ent ?? none,
    now: () => t,
    onPause: () => log.push('pause'),
    onResume: () => log.push('resume'),
  });
  return {
    adapter,
    tracker,
    mgr,
    log,
    advance: (s: number) => {
      t += s * 1000;
    },
  };
}

describe('adManager interstitial', () => {
  it('skips before firstAfterSec, then shows', async () => {
    const s = setup();
    expect(await s.mgr.onRoundBreak('r')).toBe('skipped');
    s.advance(31);
    expect(await s.mgr.onRoundBreak('r')).toBe('shown');
    expect(s.tracker.events).toEqual([['ad_shown', { type: 'interstitial', placement: 'r' }]]);
  });

  it('respects minIntervalSec', async () => {
    const s = setup();
    s.advance(31);
    expect(await s.mgr.onRoundBreak('r')).toBe('shown');
    s.advance(30);
    expect(await s.mgr.onRoundBreak('r')).toBe('skipped');
    s.advance(31);
    expect(await s.mgr.onRoundBreak('r')).toBe('shown');
  });

  it('respects everyNthBreak', async () => {
    const cfg = structuredClone(DEFAULT_MONETIZATION_CONFIG);
    cfg.yandex.interstitial = {
      enabled: true,
      minIntervalSec: 0,
      firstAfterSec: 0,
      everyNthBreak: 3,
    };
    const s = setup({ cfg });
    const res = [];
    for (let i = 0; i < 6; i++) res.push(await s.mgr.onRoundBreak('r'));
    expect(res).toEqual(['skipped', 'skipped', 'shown', 'skipped', 'skipped', 'shown']);
  });

  it('noAds blocks interstitial', async () => {
    const s = setup({ ent: () => ({ ...none(), noAds: true }) });
    s.advance(100);
    expect(await s.mgr.onRoundBreak('r')).toBe('skipped');
    expect(s.adapter.calls).toEqual([]);
  });

  it('pauses around the ad and resumes even on error', async () => {
    const s = setup();
    s.advance(100);
    await s.mgr.onRoundBreak('r');
    expect(s.adapter.calls).toEqual(['stop', 'interstitial', 'start']);
    expect(s.log).toEqual(['pause', 'resume']);
    s.adapter.showInterstitial = async () => {
      throw new Error('boom');
    };
    s.advance(100);
    expect(await s.mgr.onRoundBreak('r')).toBe('error');
    expect(s.log).toEqual(['pause', 'resume', 'pause', 'resume']);
  });

  it('disabled platform never shows', async () => {
    const cfg = structuredClone(DEFAULT_MONETIZATION_CONFIG);
    cfg.yandex.interstitial.enabled = false;
    const s = setup({ cfg });
    s.advance(1000);
    expect(await s.mgr.onRoundBreak('r')).toBe('skipped');
  });
});

describe('adManager rewarded', () => {
  it('limits rewards per session', async () => {
    const cfg = structuredClone(DEFAULT_MONETIZATION_CONFIG);
    cfg.yandex.rewarded.maxPerSession = 2;
    const s = setup({ cfg });
    expect(await s.mgr.showRewarded('p')).toBe(true);
    expect(await s.mgr.showRewarded('p')).toBe(true);
    expect(s.mgr.canShowRewarded()).toBe(false);
    expect(await s.mgr.showRewarded('p')).toBe(false);
    expect(s.tracker.events.filter(([n]) => n === 'ad_rewarded')).toHaveLength(2);
  });

  it('does not count a non-rewarded result', async () => {
    const s = setup();
    s.adapter.rewardedResult = { rewarded: false, status: 'closed' };
    expect(await s.mgr.showRewarded('p')).toBe(false);
    expect(s.tracker.events).toEqual([]);
    expect(s.mgr.canShowRewarded()).toBe(true);
  });
});
