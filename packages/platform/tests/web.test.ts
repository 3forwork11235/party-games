// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebPlatform } from '../src/web/index.js';

describe('WebPlatform', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/game/');
  });

  it('saves and loads JSON data', async () => {
    const p = new WebPlatform();
    await p.saveData('k', { a: 1 });
    expect(await p.loadData<{ a: number }>('k')).toEqual({ a: 1 });
    expect(await p.loadData('missing')).toBeNull();
  });

  it('without profile keeps the legacy storage key', async () => {
    await new WebPlatform().saveData('k', 1);
    expect(localStorage.getItem('party:data:k')).toBe('1');
  });

  it('namespaces storage by ?profile and isolates instances', async () => {
    window.history.replaceState({}, '', '/game/?profile=p2');
    const a = new WebPlatform();
    window.history.replaceState({}, '', '/game/?profile=3');
    const b = new WebPlatform();
    window.history.replaceState({}, '', '/game/');
    const plain = new WebPlatform();

    await a.saveData('nick', 'Anna');
    expect(localStorage.getItem('party:data:p2:nick')).toBe('"Anna"');
    expect(await b.loadData('nick')).toBeNull();
    expect(await plain.loadData('nick')).toBeNull();

    await b.saveData('nick', 'Boris');
    expect(await a.loadData('nick')).toBe('Anna');
    expect(await b.loadData('nick')).toBe('Boris');
    expect(localStorage.getItem('party:data:3:nick')).toBe('"Boris"');
  });

  it('reads profile once in the constructor', async () => {
    window.history.replaceState({}, '', '/game/?profile=a1');
    const p = new WebPlatform();
    window.history.replaceState({}, '', '/game/?profile=zz');
    await p.saveData('k', true);
    expect(localStorage.getItem('party:data:a1:k')).toBe('true');
  });

  it.each(['', 'ABC', 'a-b', 'toolongid1', 'a b', 'я1'])(
    'ignores invalid profile %j',
    async (bad) => {
      window.history.replaceState({}, '', `/game/?profile=${encodeURIComponent(bad)}`);
      await new WebPlatform().saveData('k', 1);
      expect(localStorage.getItem('party:data:k')).toBe('1');
      expect(localStorage.length).toBe(1);
    },
  );

  it('keeps purchases per profile', async () => {
    window.history.replaceState({}, '', '/game/?profile=2');
    const a = new WebPlatform();
    window.history.replaceState({}, '', '/game/?profile=3');
    const b = new WebPlatform();
    await a.purchase('no_ads');
    expect(await a.getPurchases()).toHaveLength(1);
    expect(await b.getPurchases()).toEqual([]);
  });

  it('invite url does not carry the profile', () => {
    window.history.replaceState({}, '', '/game/?profile=2');
    const p = new WebPlatform();
    expect(p.buildInviteUrl('ABCDE')).toBe(`${window.location.origin}/game/?room=ABCDE`);
  });

  it('builds invite url', () => {
    const p = new WebPlatform();
    expect(p.buildInviteUrl('ABCDE')).toBe(`${window.location.origin}/game/?room=ABCDE`);
  });

  it('reads launch params', () => {
    const p = new WebPlatform();
    expect(p.getLaunchParams().roomCode).toBeNull();
    window.history.replaceState({}, '', '/game/?room=XYZ12');
    expect(p.getLaunchParams().roomCode).toBe('XYZ12');
  });

  it('purchase stub is stored', async () => {
    const p = new WebPlatform();
    const r = await p.purchase('no_ads');
    expect(r.ok).toBe(true);
    expect((await p.getPurchases()).map((x) => x.productId)).toEqual(['no_ads']);
  });

  it('ad stub resolves after overlay', async () => {
    vi.useFakeTimers();
    const p = new WebPlatform();
    const pr = p.showRewarded();
    expect(document.body.textContent).toContain('Реклама');
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pr).toEqual({ rewarded: true, status: 'shown' });
    vi.useRealTimers();
  });
});
