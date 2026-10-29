import { describe, expect, it } from 'vitest';
import {
  AVATARS,
  ROOM_CODE_ALPHABET,
  TokenBucket,
  createFsm,
  generateRoomCode,
  normalizeRoomCode,
  sanitizeChat,
  sanitizeNick,
} from '../src/shared/index.js';

describe('roomCode', () => {
  it('генерирует 5 символов из алфавита', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(5);
      for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });
  it('использует переданный rng', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAA');
    expect(generateRoomCode(() => 0.999999)).toBe('99999');
  });
  it('normalizeRoomCode', () => {
    expect(normalizeRoomCode(' ab-cd2 ')).toBe('ABCD2');
    expect(normalizeRoomCode('ABCD')).toBeNull();
    expect(normalizeRoomCode('ABCDE2')).toBeNull();
    expect(normalizeRoomCode('ABCD0')).toBeNull(); // 0 нет в алфавите
    expect(normalizeRoomCode('ABCDI')).toBeNull(); // I нет в алфавите
  });
});

describe('sanitize', () => {
  it('ник: trim, схлопывание пробелов, управляющие символы', () => {
    expect(sanitizeNick('  Вася   Пупкин ', 1)).toBe('Вася Пупкин');
    expect(sanitizeNick('a\u0000b​c\nd', 1)).toBe('abc d');
  });
  it('ник: обрезка по графемам', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    expect(sanitizeNick(family.repeat(20), 1)).toBe(family.repeat(16));
    expect(sanitizeNick('x'.repeat(40), 1)).toHaveLength(16);
  });
  it('ник: пусто → Player N', () => {
    expect(sanitizeNick('   ', 3)).toBe('Player 3');
    expect(sanitizeNick('​\u0007', 2)).toBe('Player 2');
    expect(sanitizeNick(42, 5)).toBe('Player 5');
  });
  it('чат', () => {
    expect(sanitizeChat('  привет\u0000 ')).toBe('привет');
    expect(sanitizeChat('   ')).toBeNull();
    expect(sanitizeChat(null)).toBeNull();
    expect(sanitizeChat('a'.repeat(500))).toHaveLength(200);
  });
  it('аватаров 24', () => {
    expect(AVATARS).toHaveLength(24);
    expect(new Set(AVATARS).size).toBe(24);
  });
});

describe('TokenBucket', () => {
  it('расходует и пополняет токены', () => {
    const b = new TokenBucket(3, 1);
    expect([b.take(0), b.take(0), b.take(0), b.take(0)]).toEqual([true, true, true, false]);
    expect(b.take(500)).toBe(false);
    expect(b.take(1000)).toBe(true);
    expect(b.take(1000)).toBe(false);
  });
  it('не превышает ёмкость', () => {
    const b = new TokenBucket(2, 10);
    b.take(0);
    expect([b.take(60000), b.take(60000), b.take(60000)]).toEqual([true, true, false]);
  });
});

describe('fsm', () => {
  type P = 'a' | 'b' | 'c';
  const make = (log: string[] = []) =>
    createFsm<P>({
      initial: 'a',
      transitions: { a: ['b'], b: ['c', 'a'], c: [] },
      onEnter: (to, from) => log.push(`enter ${from}>${to}`),
      onExit: (from, to) => log.push(`exit ${from}>${to}`),
    });
  it('переходит и вызывает хуки', () => {
    const log: string[] = [];
    const f = make(log);
    f.go('b');
    expect(f.current).toBe('b');
    expect(log).toEqual(['exit a>b', 'enter a>b']);
  });
  it('can и недопустимый переход', () => {
    const f = make();
    expect(f.can('b')).toBe(true);
    expect(f.can('c')).toBe(false);
    expect(() => f.go('c')).toThrow(/a -> c/);
    expect(f.current).toBe('a');
  });
});
