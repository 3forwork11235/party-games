import { describe, expect, it } from 'vitest';
import { gameConfig, pointsForTaps } from '../shared/index.js';

describe('__SLUG__ logic', () => {
  it('points are non-negative integers', () => {
    expect(pointsForTaps(3)).toBe(3);
    expect(pointsForTaps(-2)).toBe(0);
    expect(pointsForTaps(2.9)).toBe(2);
  });

  it('config is sane', () => {
    expect(gameConfig.slug).toBe('__SLUG__');
    expect(gameConfig.minPlayers).toBeGreaterThanOrEqual(2);
    expect(gameConfig.maxPlayers).toBeLessThanOrEqual(8);
  });
});
