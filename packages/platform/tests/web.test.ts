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
