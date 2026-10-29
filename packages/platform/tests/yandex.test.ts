// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { YandexPlatform } from '../src/yandex/index.js';
import type { YaAdCallbacks, YaSdk } from '../src/yandex/types.js';

const g = globalThis as unknown as { YaGames?: { init(): Promise<YaSdk> } };

function mockSdk(onFullscreen: (cb: YaAdCallbacks) => void): YaSdk {
  return {
    environment: { i18n: { lang: 'ru' }, payload: 'ROOM1' },
    adv: {
      showFullscreenAdv: ({ callbacks }) => onFullscreen(callbacks),
      showRewardedVideo: ({ callbacks }) => {
        callbacks.onRewarded?.();
        callbacks.onClose?.(true);
      },
    },
    getPlayer: () => Promise.reject(new Error('no')),
    getPayments: () => Promise.reject(new Error('no')),
  };
}

afterEach(() => {
  delete g.YaGames;
  vi.restoreAllMocks();
});

describe('YandexPlatform', () => {
  it('falls back to web without SDK', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = new YandexPlatform();
    await p.init();
    expect(warn).toHaveBeenCalled();
    expect(p.id).toBe('yandex');
    expect(p.getLaunchParams().roomCode).toBeNull();
    await p.saveData('a', 1);
    expect(await p.loadData<number>('a')).toBe(1);
  });

  it('interstitial resolves on onClose', async () => {
    g.YaGames = {
      init: () => Promise.resolve(mockSdk((cb) => setTimeout(() => cb.onClose?.(true), 0))),
    };
    const p = new YandexPlatform();
    await p.init();
    expect(await p.showInterstitial()).toBe('shown');
    expect(p.getLanguage()).toBe('ru');
    expect(p.getLaunchParams().roomCode).toBe('ROOM1');
  });

  it('interstitial resolves error on onError', async () => {
    g.YaGames = {
      init: () => Promise.resolve(mockSdk((cb) => cb.onError?.(new Error('x')))),
    };
    const p = new YandexPlatform();
    await p.init();
    expect(await p.showInterstitial()).toBe('error');
  });

  it('rewarded reports reward', async () => {
    g.YaGames = { init: () => Promise.resolve(mockSdk(() => {})) };
    const p = new YandexPlatform();
    await p.init();
    expect(await p.showRewarded()).toEqual({ rewarded: true, status: 'shown' });
  });
});
