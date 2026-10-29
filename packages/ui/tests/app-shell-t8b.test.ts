// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { PartyClient } from '@party/core/client';
import { AVATARS } from '@party/core/shared';
import type { Entitlements } from '@party/monetization';
import { DEFAULT_CATALOG } from '@party/monetization';
import {
  availableAvatars,
  buildJoinOptions,
  createCosmeticsStore,
  pickRewardProduct,
} from '../src/app-shell/cosmetics.js';
import { createChatDock } from '../src/app-shell/chatDock.js';

const ent = (...ids: string[]): Entitlements => ({
  noAds: false,
  cosmetics: new Set(ids),
  packs: new Set(),
});

function storage(initial?: unknown) {
  const data = new Map<string, unknown>(initial ? [['cosmetics', initial]] : []);
  return {
    data,
    loadData: async <T>(k: string) => (data.get(k) as T | undefined) ?? null,
    saveData: async (k: string, v: unknown) => void data.set(k, v),
  };
}

describe('premium avatars', () => {
  it('are hidden without entitlement and open with it', () => {
    expect(availableAvatars(ent(), DEFAULT_CATALOG)).toEqual([...AVATARS]);
    const list = availableAvatars(ent('avatar_robot'), DEFAULT_CATALOG);
    expect(list).toContain('🤖');
    expect(list).not.toContain('🐲');
  });
});

describe('cosmetics → JoinOptions', () => {
  const profile = { playerId: 'p1', nick: 'N', avatar: '🐶' };

  it('buying a frame and nick color selects them and puts ids into JoinOptions', async () => {
    let owned = ent();
    const st = storage();
    const store = createCosmeticsStore(st, DEFAULT_CATALOG, () => owned);
    owned = ent('frame_gold', 'nick_red');
    for (const id of ['frame_gold', 'nick_red']) {
      await store.select(DEFAULT_CATALOG.find((p) => p.id === id)!);
    }
    const o = buildJoinOptions(profile, 'ru', store.get());
    expect(o.cosmetics).toEqual({ frame: 'gold', nickColor: 'red' });
    expect(st.data.get('cosmetics')).toEqual({ frame: 'gold', nickColor: 'red' });
  });

  it('drops saved cosmetics that are not owned or unknown', async () => {
    const st = storage({ frame: 'gold', nickColor: 'nope', effect: 'confetti' });
    const store = createCosmeticsStore(st, DEFAULT_CATALOG, () => ent('effect_confetti'));
    await store.load();
    expect(store.get()).toEqual({ effect: 'confetti' });
    expect(buildJoinOptions(profile, 'en', {}).cosmetics).toBeUndefined();
  });

  it('reward picks only an unowned cosmetic', () => {
    const all = DEFAULT_CATALOG.filter((p) => p.kind === 'cosmetic').map((p) => p.id);
    expect(pickRewardProduct(DEFAULT_CATALOG, ent(...all))).toBeNull();
    const p = pickRewardProduct(DEFAULT_CATALOG, ent(...all.slice(1)), () => 0.5);
    expect(p?.id).toBe(all[0]);
  });
});

describe('chat dock', () => {
  it('relays messages, replays history and blocks sending for 2s', () => {
    vi.useFakeTimers();
    const handlers: Array<(m: { nick: string; text: string }) => void> = [];
    const sent: unknown[] = [];
    const client = {
      on: (_t: string, cb: (m: never) => void) => {
        handlers.push(cb as never);
        return () => {};
      },
      send: (_t: string, p: unknown) => void sent.push(p),
    } as unknown as PartyClient;
    let now = 1000;
    const dock = createChatDock(
      client,
      (k) => k,
      () => now,
    );
    handlers[0]?.({ nick: 'a', text: 'hi' });
    const box = document.createElement('div');
    dock.mount(box);
    expect(box.textContent).toContain('hi');

    const input = box.querySelector('input')!;
    const form = box.querySelector('form')!;
    const btn = box.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    input.value = 'one';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(sent).toEqual([{ text: 'one' }]);
    expect(btn.disabled).toBe(true);
    input.value = 'two';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(sent).toHaveLength(1);
    now += 2100;
    vi.advanceTimersByTime(2100);
    expect(btn.disabled).toBe(false);
    vi.useRealTimers();
  });
});
