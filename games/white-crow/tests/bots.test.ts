import { describe, expect, it } from 'vitest';
import { BOT_DELAY_MS, botDelay, planBotPicks } from '../shared/index.js';

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length] as number;
};

describe('planBotPicks', () => {
  const options = [1, 3, 4, 5];
  const bots = ['bot:1', 'bot:2', 'bot:3'];

  it('по выбору на бота, только из options', () => {
    for (const rule of ['flock', 'pair', 'odd'] as const) {
      const plan = planBotPicks(rule, options, bots, Math.random);
      expect([...plan.keys()]).toEqual(bots);
      for (const o of plan.values()) expect(options).toContain(o);
    }
  });

  it('детерминирован при фиксированном rnd', () => {
    const a = planBotPicks('pair', options, bots, seq([0.9, 0.2, 0.7, 0.1, 0.5, 0.3, 0.8]));
    const b = planBotPicks('pair', options, bots, seq([0.9, 0.2, 0.7, 0.1, 0.5, 0.3, 0.8]));
    expect([...a]).toEqual([...b]);
  });

  it('flock с rnd -> 0: все на fav', () => {
    const plan = planBotPicks('flock', options, bots, () => 0);
    expect(new Set(plan.values())).toEqual(new Set([1]));
  });

  it('odd не использует fav, пустые options -> пусто', () => {
    const plan = planBotPicks('odd', options, bots, seq([0.99, 0, 0]));
    expect(plan.get('bot:1')).toBe(1);
    expect(planBotPicks('flock', [], bots, Math.random).size).toBe(0);
  });
});

describe('botDelay', () => {
  it('в диапазоне', () => {
    expect(botDelay(() => 0)).toBe(BOT_DELAY_MS[0]);
    expect(botDelay(() => 0.999999)).toBeLessThanOrEqual(BOT_DELAY_MS[1]);
    for (let i = 0; i < 50; i++) {
      const d = botDelay(Math.random);
      expect(d).toBeGreaterThanOrEqual(BOT_DELAY_MS[0]);
      expect(d).toBeLessThanOrEqual(BOT_DELAY_MS[1]);
    }
  });
});
