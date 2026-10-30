import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  DEFAULT_PACKS,
  HINT_CROSS,
  PACKS,
  ROLES_PER_LOCATION,
  SPY_CATALOG,
  assignRoles,
  buildBoard,
  findAccused,
  gameConfig,
  isPackId,
  locationIds,
  nextAsker,
  parseLocationId,
  pickHint,
  pickLocation,
  pickSpy,
  scoreRound,
  type PackId,
} from '../shared/index.js';

/** Детерминированный генератор (LCG) для воспроизводимых проверок. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const map = <V>(o: Record<string, V>): Map<string, V> => new Map(Object.entries(o));

describe('config и каталог', () => {
  it('конфиг по SPEC', () => {
    expect(gameConfig).toMatchObject({
      slug: 'spy',
      minPlayers: 3,
      maxPlayers: 8,
      rounds: 5,
      countdownMs: 3000,
      roundMs: 15000,
      roundEndMs: 12000,
      idleKickSec: 600,
    });
  });

  it('10 товаров: 6 скинов и 4 пака', () => {
    expect(SPY_CATALOG).toHaveLength(10);
    expect(SPY_CATALOG.filter((p) => p.category === 'skin')).toHaveLength(6);
    const packs = SPY_CATALOG.filter((p) => p.kind === 'pack').map((p) => p.pack?.packId);
    expect(packs).toEqual(['movies', 'space', 'history', 'all']);
    for (const p of SPY_CATALOG) expect(p.titleKey).toBe(`shop.${p.id}`);
  });
});

describe('packs', () => {
  it('6 паков по 20, бесплатные — первые три', () => {
    expect(PACKS).toHaveLength(6);
    expect(PACKS.every((p) => p.size === 20)).toBe(true);
    expect(PACKS.filter((p) => p.free).map((p) => p.id)).toEqual([...DEFAULT_PACKS]);
    expect(isPackId('space')).toBe(true);
    expect(isPackId('nope')).toBe(false);
    expect(isPackId(3)).toBe(false);
  });

  it('locationIds и parseLocationId', () => {
    const ids = locationIds(['city', 'space']);
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    expect(ids[0]).toBe('city/0');
    expect(locationIds(['city', 'city'])).toHaveLength(20);
    expect(locationIds([])).toEqual([]);
    expect(parseLocationId('space/19')).toEqual({ pack: 'space', index: 19 });
    for (const bad of ['space/20', 'space/-1', 'space/01', 'nope/1', 'city', '/1', 'city/1/2']) {
      expect(parseLocationId(bad)).toBeNull();
    }
  });
});

describe('pickSpy', () => {
  const ids = ['A', 'B', 'C', 'D'];

  it('берёт игрока с минимальным числом шпионств', () => {
    const count = map({ A: 2, B: 1, C: 1, D: 3 });
    for (let i = 0; i < 30; i++) {
      expect(['B', 'C']).toContain(pickSpy(ids, count, '', seeded(i)));
    }
  });

  it('не повторяет прошлого шпиона, если есть другие', () => {
    const count = map({ A: 0, B: 0, C: 5, D: 5 });
    for (let i = 0; i < 30; i++) expect(pickSpy(ids, count, 'A', seeded(i))).toBe('B');
    expect(pickSpy(['A'], new Map(), 'A', Math.random)).toBe('A');
    expect(pickSpy([], new Map(), '', Math.random)).toBe('');
  });

  it('все получают роль поровну за серию раундов', () => {
    const count = new Map<string, number>();
    let last = '';
    const rnd = seeded(7);
    for (let i = 0; i < 12; i++) {
      last = pickSpy(ids, count, last, rnd);
      count.set(last, (count.get(last) ?? 0) + 1);
    }
    expect([...count.values()]).toEqual([3, 3, 3, 3]);
  });
});

describe('pickLocation и buildBoard', () => {
  const packs: PackId[] = ['city', 'travel'];

  it('не использованная в партии, при исчерпании — из всех', () => {
    const all = locationIds(packs);
    const used = new Set(all.slice(0, 39));
    expect(pickLocation(packs, used, seeded(1))).toBe('travel/19');
    expect(all).toContain(pickLocation(packs, new Set(all), seeded(2)));
    expect(pickLocation([], new Set(), seeded(3))).toBe('');
  });

  it('поле: уникально, перемешано, содержит локацию, размер min(size, доступно)', () => {
    const board = buildBoard(packs, 'travel/5', BOARD_SIZE, seeded(4));
    expect(board).toHaveLength(BOARD_SIZE);
    expect(new Set(board).size).toBe(BOARD_SIZE);
    expect(board).toContain('travel/5');
    expect(board.every((id) => locationIds(packs).includes(id))).toBe(true);
    expect(buildBoard(packs, 'travel/5', BOARD_SIZE, seeded(5))).not.toEqual(board);
    // один пак — всего 20
    expect(buildBoard(['city'], 'city/3', BOARD_SIZE, seeded(6))).toHaveLength(20);
    expect(buildBoard(packs, 'city/0', 5, seeded(7))).toHaveLength(5);
  });

  it('позиция настоящей локации не зафиксирована', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 40; i++) {
      positions.add(buildBoard(packs, 'city/1', BOARD_SIZE, seeded(i)).indexOf('city/1'));
    }
    expect(positions.size).toBeGreaterThan(5);
  });
});

describe('assignRoles', () => {
  it('разные индексы 0..6', () => {
    for (let seed = 0; seed < 20; seed++) {
      const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const roles = assignRoles(ids, seeded(seed));
      expect([...roles.keys()]).toEqual(ids);
      const idx = [...roles.values()];
      expect(new Set(idx).size).toBe(7);
      expect(idx.every((i) => Number.isInteger(i) && i >= 0 && i < ROLES_PER_LOCATION)).toBe(true);
    }
    expect(assignRoles([]).size).toBe(0);
  });
});

describe('pickHint', () => {
  const board = locationIds(['city', 'travel']).slice(0, 24);
  const real = board[3] as string;

  it('новый накопленный список, только неверные, без повторов', () => {
    const first = pickHint(board, real, [], HINT_CROSS, seeded(1));
    expect(first).toHaveLength(HINT_CROSS);
    expect(first).not.toContain(real);
    const second = pickHint(board, real, first, HINT_CROSS, seeded(2));
    expect(second).toHaveLength(2 * HINT_CROSS);
    expect(second.slice(0, HINT_CROSS)).toEqual(first);
    expect(new Set(second).size).toBe(second.length);
    expect(second).not.toContain(real);
    expect(first).toHaveLength(HINT_CROSS); // вход не мутирован
  });

  it('никогда не зачёркивает всё поле: максимум board.length - 1', () => {
    const small = board.slice(0, 5);
    const realSmall = small[0] as string;
    const all = pickHint(small, realSmall, [], 100, seeded(3));
    expect(all).toHaveLength(4);
    expect(all).not.toContain(realSmall);
    expect(pickHint(small, realSmall, all, 3, seeded(4))).toEqual(all);
  });
});

describe('findAccused', () => {
  it('строгий максимум; ничья и пустота → пустая строка', () => {
    expect(findAccused(map({ A: 'B', C: 'B', D: 'A' }))).toBe('B');
    expect(findAccused(map({ A: 'B', B: 'A' }))).toBe('');
    expect(findAccused(map({ A: 'B', B: 'A', C: 'B', D: 'A', E: 'C' }))).toBe('');
    expect(findAccused(new Map())).toBe('');
    expect(findAccused(map({ A: '' }))).toBe('');
  });
});

describe('nextAsker', () => {
  const order = ['A', 'B', 'C', 'D'];

  it('следующий подключённый по кругу', () => {
    const all = new Set(order);
    expect(nextAsker(order, 'A', all)).toBe('B');
    expect(nextAsker(order, 'D', all)).toBe('A');
    expect(nextAsker(order, 'A', new Set(['A', 'C', 'D']))).toBe('C');
    expect(nextAsker(order, 'C', new Set(['A', 'B', 'C']))).toBe('A');
  });

  it('текущий уже вне порядка/офлайн; единственный подключённый', () => {
    expect(nextAsker(order, '', new Set(['C', 'D']))).toBe('C');
    expect(nextAsker(order, 'B', new Set(['C', 'D']))).toBe('C');
    expect(nextAsker(order, 'B', new Set(['B']))).toBe('B');
    expect(nextAsker(order, 'B', new Set())).toBe('');
  });
});

describe('scoreRound (SPEC §5)', () => {
  const players = ['A', 'B', 'C', 'D'];

  it('пример 1: ничья → spy_escaped', () => {
    const votes = map({ B: 'A', C: 'A', D: 'B', A: 'B' });
    expect(findAccused(votes)).toBe('');
    expect(scoreRound({ outcome: 'spy_escaped', spyId: 'A', players, votes })).toEqual({
      A: 2,
      B: 1,
      C: 1,
      D: 0,
    });
  });

  it('пример 2: D→A, обвинён шпион, не угадал → spy_caught', () => {
    const votes = map({ B: 'A', C: 'A', D: 'A', A: 'B' });
    expect(findAccused(votes)).toBe('A');
    expect(scoreRound({ outcome: 'spy_caught', spyId: 'A', players, votes })).toEqual({
      A: 0,
      B: 2,
      C: 2,
      D: 2,
    });
  });

  it('догадка шпиона: +4 (досрочно голосов нет, в последнем шансе голоса считаются)', () => {
    const none = new Map<string, string>();
    expect(scoreRound({ outcome: 'spy_guessed', spyId: 'A', players, votes: none })).toEqual({
      A: 4,
      B: 0,
      C: 0,
      D: 0,
    });
    const votes = map({ B: 'A', C: 'A', D: 'A', A: 'B' });
    expect(scoreRound({ outcome: 'spy_guessed', spyId: 'A', players, votes })).toEqual({
      A: 4,
      B: 1,
      C: 1,
      D: 1,
    });
  });

  it('неверная досрочная догадка: команда +1', () => {
    const none = new Map<string, string>();
    expect(scoreRound({ outcome: 'spy_wrong', spyId: 'A', players, votes: none })).toEqual({
      A: 0,
      B: 1,
      C: 1,
      D: 1,
    });
  });

  it('голос шпиона за себя и чужие игроки не дают очков', () => {
    const votes = map({ A: 'A', X: 'A' });
    expect(scoreRound({ outcome: 'spy_escaped', spyId: 'A', players, votes })).toEqual({
      A: 2,
      B: 0,
      C: 0,
      D: 0,
    });
  });
});
