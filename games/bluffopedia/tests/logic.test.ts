import { describe, expect, it } from 'vitest';
import {
  BLUFF_CATALOG,
  MIN_OPTIONS,
  PACKS,
  buildOptions,
  gameConfig,
  isPackId,
  isTruth,
  parseQuestionId,
  pickHint,
  pickQuestion,
  questionIds,
  scoreRound,
  type Option,
} from '../shared/index.js';

const seq =
  (...v: number[]) =>
  () =>
    v.shift() ?? 0;
const lies = (o: Record<string, string>): Map<string, string> => new Map(Object.entries(o));
const input = (l: Record<string, string>, fakes = ['f1', 'f2']) => ({
  truth: 'Truth',
  alt: ['The Truth'],
  fakes,
  lies: lies(l),
});

describe('config / packs / catalog', () => {
  it('config is sane', () => {
    expect(gameConfig.slug).toBe('bluffopedia');
    expect([gameConfig.minPlayers, gameConfig.maxPlayers]).toEqual([3, 8]);
    expect(gameConfig.roundMs).toBe(45000);
  });

  it('packs and ids', () => {
    expect(PACKS.map((p) => p.id)).toEqual(['words', 'facts', 'laws', 'records']);
    expect(isPackId('laws')).toBe(true);
    expect(isPackId('x')).toBe(false);
    expect(questionIds(['words', 'words'])).toHaveLength(100);
    expect(questionIds(['words', 'records'])).toHaveLength(200);
    expect(parseQuestionId('facts/42')).toEqual({ pack: 'facts', index: 42 });
    expect(parseQuestionId('facts/100')).toBeNull();
    expect(parseQuestionId('facts/01')).toBeNull();
    expect(parseQuestionId('nope/1')).toBeNull();
  });

  it('catalog: 6 fonts with preview, 3 packs', () => {
    const fonts = BLUFF_CATALOG.filter((p) => p.kind === 'cosmetic');
    expect(fonts).toHaveLength(6);
    expect(fonts.every((p) => p.category === 'skin' && p.value === p.id && p.preview)).toBe(true);
    expect(BLUFF_CATALOG.filter((p) => p.kind === 'pack')).toHaveLength(3);
    expect(BLUFF_CATALOG.every((p) => p.titleKey === `shop.${p.id}`)).toBe(true);
  });
});

describe('pickQuestion', () => {
  it('skips used questions', () => {
    const used = new Set(questionIds(['words']).slice(1));
    expect(pickQuestion(['words'], used, () => 0.99)).toBe('words/0');
  });
  it('all used -> picks from all', () => {
    const used = new Set(questionIds(['words']));
    expect(pickQuestion(['words'], used, () => 0)).toBe('words/0');
  });
});

describe('isTruth', () => {
  it('matches answer and alt by normalization', () => {
    expect(isTruth('  TRUTH! ', 'Truth', [])).toBe(true);
    expect(isTruth('the-truth', 'Truth', ['The Truth'])).toBe(true);
    expect(isTruth('Lie', 'Truth', ['The Truth'])).toBe(false);
  });
  it('ё equals е', () => {
    expect(isTruth('Ёлка', 'елка', [])).toBe(true);
  });
});

describe('buildOptions', () => {
  it('truth + unique lies, ids o1..oN, authors tracked', () => {
    const opts = buildOptions(input({ A: 'x1', B: 'y1', C: 'z1' }), seq(0.1, 0.5, 0.9));
    expect(opts.map((o) => o.id)).toEqual(['o1', 'o2', 'o3', 'o4']);
    expect(opts.filter((o) => o.kind === 'house')).toHaveLength(0);
    expect(opts.find((o) => o.kind === 'truth')?.authors).toEqual([]);
    expect(opts.filter((o) => o.kind === 'lie').flatMap((o) => o.authors).sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('merges equal lies, text of the first author', () => {
    const opts = buildOptions(input({ A: 'Cat!', B: 'cat', C: 'dog' }));
    const merged = opts.find((o) => o.authors.length === 2);
    expect(merged?.text).toBe('Cat!');
    expect(merged?.authors).toEqual(['A', 'B']);
    expect(opts.filter((o) => o.kind === 'lie')).toHaveLength(2);
  });

  it('pads with house fakes up to MIN_OPTIONS, skipping clashes', () => {
    const opts = buildOptions(input({ A: 'f1' }, ['F1', 'truth', 'f2', 'f3', 'f4']));
    expect(opts).toHaveLength(MIN_OPTIONS);
    const house = opts.filter((o) => o.kind === 'house').map((o) => o.text).sort();
    expect(house).toEqual(['f2', 'f3']);
  });

  it('no lies: truth + 3 fakes; no padding when enough', () => {
    expect(buildOptions(input({}, ['a', 'b', 'c', 'd']))).toHaveLength(4);
    const many = buildOptions(input({ A: '1', B: '2', C: '3', D: '4' }));
    expect(many).toHaveLength(5);
    expect(many.some((o) => o.kind === 'house')).toBe(false);
  });

  it('drops lies equal to the truth', () => {
    const opts = buildOptions(input({ A: 'truth', B: 'the truth' }, ['a', 'b', 'c']));
    expect(opts.filter((o) => o.kind === 'truth')).toHaveLength(1);
    expect(opts.filter((o) => o.kind === 'lie')).toHaveLength(0);
  });
});

const O = (id: string, kind: Option['kind'], authors: string[] = []): Option => ({
  id,
  kind,
  authors,
  text: id,
});

describe('pickHint', () => {
  const opts = [O('o1', 'truth'), O('o2', 'lie', ['A']), O('o3', 'lie', ['B']), O('o4', 'house')];
  it('picks a false option that is not own', () => {
    for (let i = 0; i < 20; i++) expect(['o3', 'o4']).toContain(pickHint(opts, 'A', Math.random));
    expect(pickHint(opts, 'A', () => 0)).toBe('o3');
    expect(pickHint(opts, 'A', () => 0.99)).toBe('o4');
    expect(pickHint(opts, 'Z', () => 0)).toBe('o2');
  });
  it('boundary: needs at least 2 candidates', () => {
    expect(pickHint([O('o1', 'truth'), O('o2', 'lie', ['B']), O('o3', 'lie', ['A'])], 'A', Math.random)).toBe(
      '',
    );
    expect(pickHint([O('o1', 'truth'), O('o2', 'lie', ['B']), O('o3', 'lie', ['C'])], 'A', () => 0)).toBe('o2');
  });
});

describe('scoreRound', () => {
  it('SPEC example', () => {
    const options = [O('t', 'truth'), O('x', 'lie', ['A', 'C']), O('y', 'lie', ['B'])];
    const votes = new Map([
      ['A', 'y'],
      ['B', 't'],
      ['C', 'y'],
      ['D', 'x'],
    ]);
    expect(scoreRound(options, votes, ['A', 'B', 'C', 'D'])).toEqual({ A: 1, B: 4, C: 1, D: 0 });
  });
  it('house fakes give nothing; missing votes and foreign voters ignored', () => {
    const options = [O('t', 'truth'), O('h', 'house'), O('x', 'lie', ['A'])];
    const votes = new Map([
      ['B', 'h'],
      ['Z', 't'],
      ['A', 'x'],
    ]);
    expect(scoreRound(options, votes, ['A', 'B', 'C'])).toEqual({ A: 0, B: 0, C: 0 });
  });
});
