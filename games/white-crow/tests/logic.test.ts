import { describe, expect, it } from 'vitest';
import {
  FINAL_MULTIPLIER,
  buildDeck,
  buildRules,
  gameConfig,
  groupPicks,
  parseQuestionId,
  pickShown,
  roundStats,
  scoreRound,
  shownCount,
  type Rule,
} from '../shared/index.js';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('config', () => {
  it('is sane', () => {
    expect(gameConfig.slug).toBe('white-crow');
    expect(gameConfig.minPlayers).toBe(3);
    expect(gameConfig.maxPlayers).toBe(8);
  });
});

describe('buildRules', () => {
  it.each([6, 9, 12, 7])('rounds=%i: длина, без повторов подряд', (n) => {
    for (let seed = 1; seed <= 50; seed++) {
      const rules = buildRules(n, seeded(seed));
      expect(rules).toHaveLength(n);
      for (let i = 1; i < rules.length; i++) expect(rules[i]).not.toBe(rules[i - 1]);
    }
  });

  it.each([6, 9, 12])('rounds=%i: каждое правило поровну', (n) => {
    const rules = buildRules(n, seeded(n));
    for (const r of ['flock', 'pair', 'odd'] as Rule[]) {
      expect(rules.filter((x) => x === r)).toHaveLength(n / 3);
    }
  });
});

describe('buildDeck', () => {
  it('уникальные id только из выбранных паков', () => {
    const deck = buildDeck(['food'], 12, new Set(), seeded(1));
    expect(deck).toHaveLength(12);
    expect(new Set(deck).size).toBe(12);
    expect(deck.every((q) => parseQuestionId(q)?.pack === 'food')).toBe(true);
  });

  it('сначала неиспользованные, затем добор', () => {
    const used = new Set<string>();
    for (let i = 0; i < 38; i++) used.add(`food/${i}`);
    const deck = buildDeck(['food'], 5, used, seeded(2));
    expect(new Set(deck).size).toBe(5);
    expect(deck.slice(0, 2).sort()).toEqual(['food/38', 'food/39']);
    expect(deck.slice(2).every((q) => used.has(q))).toBe(true);
  });

  it('вопросов меньше count: повторы, длина count', () => {
    const deck = buildDeck(['food'], 50, new Set(), seeded(3));
    expect(deck).toHaveLength(50);
    expect(new Set(deck).size).toBe(40);
  });
});

describe('shown options', () => {
  it('shownCount', () => {
    expect([2, 3, 4, 5, 8].map(shownCount)).toEqual([4, 4, 5, 6, 6]);
  });
  it('pickShown: разные индексы 0..5', () => {
    for (const n of [3, 4, 8]) {
      const s = pickShown(n, seeded(n));
      expect(s).toHaveLength(shownCount(n));
      expect(new Set(s).size).toBe(s.length);
      expect(s.every((i) => Number.isInteger(i) && i >= 0 && i <= 5)).toBe(true);
    }
  });
});

describe('scoring (пример SPEC §5)', () => {
  const picks = new Map([
    ['A', 0],
    ['B', 0],
    ['C', 0],
    ['D', 1],
    ['E', 1],
    ['F', 2],
  ]);
  it('flock', () => {
    expect(scoreRound('flock', picks)).toEqual({ A: 2, B: 2, C: 2, D: 1, E: 1 });
  });
  it('pair', () => {
    expect(scoreRound('pair', picks)).toEqual({ D: 3, E: 3 });
  });
  it('odd', () => {
    expect(scoreRound('odd', picks)).toEqual({ F: 3 });
  });
  it('множитель финала', () => {
    expect(scoreRound('odd', picks, FINAL_MULTIPLIER)).toEqual({ F: 6 });
    expect(scoreRound('flock', picks, 2).A).toBe(4);
  });
  it('пустые выборы', () => {
    expect(scoreRound('flock', new Map())).toEqual({});
    expect(scoreRound('odd', new Map())).toEqual({});
  });
  it('groupPicks / roundStats', () => {
    expect(groupPicks(picks).get(0)).toEqual(['A', 'B', 'C']);
    expect(roundStats(picks)).toEqual({
      lone: ['F'],
      matches: { A: 2, B: 2, C: 2, D: 1, E: 1 },
    });
  });
});
