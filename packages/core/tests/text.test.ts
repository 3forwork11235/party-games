import { describe, expect, it } from 'vitest';
import { maskProfanity, normalizeAnswer, sanitizeAnswer, sanitizeChat } from '../src/shared/index.js';

describe('sanitizeAnswer', () => {
  it('collapses spaces, strips control chars, trims', () => {
    expect(sanitizeAnswer('  a \n\t b​  ', 20)).toBe('a b');
  });
  it('returns null for empty / non-string', () => {
    expect(sanitizeAnswer('   ', 10)).toBeNull();
    expect(sanitizeAnswer(5, 10)).toBeNull();
    expect(sanitizeAnswer('\u0000​', 10)).toBeNull();
  });
  it('cuts by graphemes', () => {
    expect(sanitizeAnswer('👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧', 2)).toBe('👨‍👩‍👧👨‍👩‍👧');
    expect(sanitizeAnswer('abcdef', 3)).toBe('abc');
  });
});

describe('normalizeAnswer', () => {
  it('drops punctuation, quotes, dashes; folds case and ё', () => {
    expect(normalizeAnswer('Не читать их!')).toBe('не читать их');
    expect(normalizeAnswer('«Ёж» — это  "ЕЖ"')).toBe('еж это еж');
    expect(normalizeAnswer('Ｔest-case')).toBe('test case');
  });
});

describe('maskProfanity', () => {
  it('masks whole words', () => {
    expect(maskProfanity('ты Мудак и fuck')).toBe('ты *** и ***');
    expect(maskProfanity('Пиздец')).toBe('***');
  });
  it('does not touch harmless words', () => {
    for (const w of ['хлебать', 'скорбь', 'class', 'assistant', 'Scunthorpe', 'привет'])
      expect(maskProfanity(w)).toBe(w);
  });
  it('sanitizeChat masks', () => {
    expect(sanitizeChat('hello shit')).toBe('hello ***');
  });
});
