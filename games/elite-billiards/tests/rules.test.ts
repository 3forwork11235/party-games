import { describe, expect, it } from 'vitest';
import {
  PENALTY_NO_HIT,
  PENALTY_SCRATCH,
  PENALTY_TIMEOUT,
  clampRackScore,
  firstShooter,
  nextShooter,
  resolveShot,
  resolveTimeout,
} from '../shared/index.js';

const values = new Map<number, number>([
  [1, 1],
  [2, 2],
  [9, 5],
  [10, 8],
]);

describe('resolveShot', () => {
  it('sums values of potted targets and keeps the turn', () => {
    const r = resolveShot({ result: { potted: [2, 9], firstHit: 2 }, values, cueInHand: false });
    expect(r).toEqual({ points: 7, foul: '', keepTurn: true, cueInHandNext: false });
  });

  it('gives no points and passes the turn when nothing is potted', () => {
    const r = resolveShot({ result: { potted: [], firstHit: 1 }, values, cueInHand: false });
    expect(r.points).toBe(0);
    expect(r.foul).toBe('');
    expect(r.keepTurn).toBe(false);
  });

  it('scratch: penalty, potted targets do not count, cue in hand next', () => {
    const r = resolveShot({ result: { potted: [10, 0], firstHit: 10 }, values, cueInHand: false });
    expect(r).toEqual({
      points: -PENALTY_SCRATCH,
      foul: 'scratch',
      keepTurn: false,
      cueInHandNext: true,
    });
  });

  it('noHit: penalty when the cue touched nothing', () => {
    const r = resolveShot({ result: { potted: [], firstHit: -1 }, values, cueInHand: true });
    expect(r.foul).toBe('noHit');
    expect(r.points).toBe(-PENALTY_NO_HIT);
    expect(r.keepTurn).toBe(false);
    expect(r.cueInHandNext).toBe(false);
  });

  it('timeout keeps cueInHand', () => {
    expect(resolveTimeout(true)).toEqual({
      points: -PENALTY_TIMEOUT,
      foul: 'timeout',
      keepTurn: false,
      cueInHandNext: true,
    });
    expect(resolveTimeout(false).cueInHandNext).toBe(false);
  });
});

describe('turn order', () => {
  const order = ['a', 'b', 'c'];
  const all = (): boolean => true;

  it('nextShooter wraps and skips disconnected', () => {
    expect(nextShooter(order, 'a', all)).toBe('b');
    expect(nextShooter(order, 'c', all)).toBe('a');
    expect(nextShooter(order, 'a', (id) => id !== 'b')).toBe('c');
    expect(nextShooter(order, 'a', (id) => id === 'a')).toBe('a');
    expect(nextShooter(order, 'a', () => false)).toBe('');
    expect(nextShooter([], 'a', all)).toBe('');
  });

  it('firstShooter rotates by round and skips disconnected', () => {
    expect(firstShooter(order, 1, all)).toBe('a');
    expect(firstShooter(order, 2, all)).toBe('b');
    expect(firstShooter(order, 4, all)).toBe('a');
    expect(firstShooter(order, 2, (id) => id !== 'b')).toBe('c');
  });

  it('clampRackScore floors at zero', () => {
    expect(clampRackScore(-3)).toBe(0);
    expect(clampRackScore(4)).toBe(4);
  });
});
