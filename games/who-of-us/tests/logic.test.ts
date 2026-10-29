import { describe, expect, it } from 'vitest';
import type { Entitlements } from '@party/monetization';
import {
  DEFAULT_PACKS,
  GUESS_POINTS,
  PACKS,
  WOU_CATALOG,
  buildDeck,
  drawReplacement,
  findLeaders,
  gameConfig,
  isPackId,
  ownedPacks,
  scoreRound,
  tallyVotes,
  type Vote,
} from '../shared/index.js';

const votesOf = (o: Record<string, [string, string]>): Map<string, Vote> =>
  new Map(Object.entries(o).map(([id, [target, guess]]) => [id, { target, guess }]));

describe('scoring', () => {
  const present = new Set(['A', 'B', 'C']);

  it('пример из SPEC', () => {
    const votes = votesOf({ A: ['B', 'B'], B: ['B', 'C'], C: ['A', 'B'] });
    const tally = tallyVotes(votes, present);
    expect(tally).toEqual({ B: 2, A: 1 });
    const leaders = findLeaders(tally);
    expect(leaders).toEqual(['B']);
    expect(scoreRound(votes, leaders)).toEqual({ A: GUESS_POINTS, C: GUESS_POINTS });
  });

  it('ничья: угадал любого лидера', () => {
    const votes = votesOf({ A: ['B', 'A'], B: ['A', 'B'], C: ['C', 'C'] });
    const tally = tallyVotes(votes, present);
    const leaders = findLeaders(tally);
    expect(leaders.sort()).toEqual(['A', 'B', 'C']);
    expect(Object.keys(scoreRound(votes, leaders)).sort()).toEqual(['A', 'B', 'C']);
  });

  it('нет голосов: нет лидеров и очков', () => {
    const tally = tallyVotes(new Map(), present);
    expect(tally).toEqual({});
    expect(findLeaders(tally)).toEqual([]);
    expect(scoreRound(votesOf({ A: ['B', 'B'] }), [])).toEqual({});
  });

  it('голоса за отсутствующих не учитываются', () => {
    const tally = tallyVotes(votesOf({ A: ['Z', 'Z'], B: ['C', 'C'] }), present);
    expect(tally).toEqual({ C: 1 });
  });
});

describe('deck', () => {
  it('без повторов и только из выбранных паков', () => {
    const deck = buildDeck(['work', 'party'], 10);
    expect(deck).toHaveLength(10);
    expect(new Set(deck).size).toBe(10);
    expect(deck.every((q) => /^(work|party)\/\d+$/.test(q))).toBe(true);
  });

  it('вопросов меньше count — сколько есть; дубли паков игнорируются', () => {
    expect(buildDeck(['work', 'work'], 100)).toHaveLength(60);
  });

  it('drawReplacement не возвращает уже использованные', () => {
    const deck = buildDeck(['work'], 10);
    const used = new Set(deck);
    const r = drawReplacement(deck, used, ['work']);
    expect(r).not.toBeNull();
    expect(used.has(r as string)).toBe(false);
    const all = new Set(buildDeck(['work'], 60));
    expect(drawReplacement([], all, ['work'])).toBeNull();
  });
});

describe('packs, catalog, config', () => {
  it('config', () => {
    expect(gameConfig.slug).toBe('who-of-us');
    expect(gameConfig.minPlayers).toBe(3);
    expect(gameConfig.maxPlayers).toBe(10);
    expect(gameConfig.rounds).toBe(10);
  });

  it('паки', () => {
    expect(PACKS).toHaveLength(5);
    expect(isPackId('work')).toBe(true);
    expect(isPackId('nope')).toBe(false);
    expect(DEFAULT_PACKS.every((id) => PACKS.find((p) => p.id === id)?.free)).toBe(true);
  });

  it('ownedPacks: free + купленные + бандл', () => {
    const ent = (packs: string[]): Entitlements => ({
      noAds: false,
      cosmetics: new Set(),
      packs: new Set(packs),
    });
    expect([...ownedPacks(ent([]))].sort()).toEqual(['family', 'friends']);
    expect(ownedPacks(ent(['who-of-us/work'])).has('work')).toBe(true);
    expect(ownedPacks(ent(['other/work'])).has('work')).toBe(false);
    expect(ownedPacks(ent(['who-of-us/all'])).size).toBe(5);
  });

  it('каталог: уникальные id', () => {
    const ids = WOU_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('pack_wou_all');
  });
});
