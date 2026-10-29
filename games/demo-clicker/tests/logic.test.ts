import { describe, expect, it } from 'vitest';
import { createTapLimiter, gameConfig, scoreRound } from '../shared/index.js';

describe('scoreRound', () => {
  it('1st=3, 2nd=2, 3rd=1, rest and unfinished = 0', () => {
    expect(scoreRound(['a', 'b'])).toEqual({ a: 3, b: 2 });
    expect(scoreRound(['a', 'b', 'c', 'd'])).toEqual({ a: 3, b: 2, c: 1, d: 0 });
    expect(scoreRound([])).toEqual({});
  });
});

describe('createTapLimiter', () => {
  it('allows at most 20 per sliding 1s window', () => {
    const l = createTapLimiter(20, 1000);
    let ok = 0;
    for (let i = 0; i < 30; i++) if (l.allow(100 + i)) ok++;
    expect(ok).toBe(20);
    expect(l.allow(1050)).toBe(false); // первые нажатия ещё в окне
    expect(l.allow(1100)).toBe(true); // окно сдвинулось (t=100 вышло)
  });

  it('reset clears the window', () => {
    const l = createTapLimiter(1, 1000);
    expect(l.allow(0)).toBe(true);
    expect(l.allow(1)).toBe(false);
    l.reset();
    expect(l.allow(2)).toBe(true);
  });
});

describe('config', () => {
  it('matches spec', () => {
    expect(gameConfig).toMatchObject({
      slug: 'demo-clicker',
      rounds: 3,
      countdownMs: 3000,
      roundMs: 20000,
      roundEndMs: 4000,
    });
  });
});
