import { describe, expect, it } from 'vitest';
import { createRack, isValidCuePlacement } from '../shared/rack.js';
import {
  BALL_SPECS,
  CUSHIONS,
  FOOT_SPOT,
  HEAD_SPOT,
  KITCHEN_X,
  L,
  POCKETS,
  W,
  isInsideTable,
  massOf,
} from '../shared/table.js';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('table', () => {
  it('содержит 6 луз и 6 бортов', () => {
    expect(POCKETS).toHaveLength(6);
    expect(CUSHIONS).toHaveLength(6);
    expect(HEAD_SPOT).toEqual({ x: L / 4, y: W / 2 });
    expect(FOOT_SPOT).toEqual({ x: (3 * L) / 4, y: W / 2 });
    expect(KITCHEN_X).toBe(L / 4);
  });

  it('массы растут как r^3, эталон 0.17 кг', () => {
    expect(massOf(0.0286)).toBeCloseTo(0.17, 10);
    expect(massOf(0.042) / massOf(0.0286)).toBeCloseTo((0.042 / 0.0286) ** 3, 10);
    expect(massOf(BALL_SPECS.small.r)).toBeLessThan(massOf(BALL_SPECS.giant.r));
  });

  it('isInsideTable', () => {
    expect(isInsideTable(1, 1)).toBe(true);
    expect(isInsideTable(-0.01, 1)).toBe(false);
    expect(isInsideTable(1, W + 0.01)).toBe(false);
  });
});

describe('createRack', () => {
  const rack = createRack(mulberry32(1));

  it('биток id 0 в HEAD_SPOT + 10 прицельных', () => {
    expect(rack).toHaveLength(11);
    expect(rack.map((b) => b.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rack[0]).toMatchObject({ kind: 'cue', x: HEAD_SPOT.x, y: HEAD_SPOT.y });
  });

  it('состав по видам и номиналам', () => {
    const count = (k: string): number => rack.filter((b) => b.kind === k).length;
    expect(count('small')).toBe(3);
    expect(count('std')).toBe(3);
    expect(count('big')).toBe(2);
    expect(count('giant')).toBe(1);
    expect(count('gold')).toBe(1);
    for (const b of rack) {
      expect(b.r).toBe(BALL_SPECS[b.kind].r);
      expect(b.value).toBe(BALL_SPECS[b.kind].value);
    }
  });

  it('вершина в точке пирамиды, gold в центре 3-го ряда, без перекрытий', () => {
    const targets = rack.filter((b) => b.id > 0);
    const apex = targets.reduce((m, b) => (b.x < m.x ? b : m));
    expect(apex.x).toBeCloseTo(FOOT_SPOT.x, 10);
    expect(apex.y).toBeCloseTo(FOOT_SPOT.y, 10);
    const gold = rack.find((b) => b.kind === 'gold');
    const row3 = targets.filter((b) => Math.abs(b.x - (gold?.x ?? 0)) < 1e-9);
    expect(row3).toHaveLength(3);
    expect(gold?.y).toBeCloseTo(W / 2, 10);
    for (const a of rack) {
      expect(isInsideTable(a.x, a.y)).toBe(true);
      for (const b of rack) {
        if (a.id >= b.id) continue;
        const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        expect(d).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it('детерминирован по rng и перемешивает', () => {
    expect(createRack(mulberry32(7))).toEqual(createRack(mulberry32(7)));
    const layouts = new Set<string>();
    for (let s = 0; s < 10; s++) {
      layouts.add(
        createRack(mulberry32(s))
          .map((b) => `${b.kind}@${b.x.toFixed(4)},${b.y.toFixed(4)}`)
          .join('|'),
      );
    }
    expect(layouts.size).toBeGreaterThan(5);
    for (let s = 0; s < 20; s++) {
      const r = createRack(mulberry32(s));
      const gold = r.find((b) => b.kind === 'gold');
      expect(gold?.y).toBeCloseTo(W / 2, 10);
    }
  });
});

describe('isValidCuePlacement', () => {
  const rack = createRack(mulberry32(3));
  it('принимает точку в доме', () => {
    expect(isValidCuePlacement(HEAD_SPOT.x, HEAD_SPOT.y, rack)).toBe(true);
    expect(isValidCuePlacement(0.3, 0.3, rack)).toBe(true);
  });
  it('отклоняет вне дома, у борта и NaN', () => {
    expect(isValidCuePlacement(KITCHEN_X + 0.01, W / 2, rack)).toBe(false);
    expect(isValidCuePlacement(0.01, W / 2, rack)).toBe(false);
    expect(isValidCuePlacement(0.3, W - 0.01, rack)).toBe(false);
    expect(isValidCuePlacement(Number.NaN, 0.5, rack)).toBe(false);
  });
  it('отклоняет перекрытие с шаром, игнорирует забитые', () => {
    const blocker = [{ id: 1, x: 0.4, y: 0.6, r: 0.042 }];
    expect(isValidCuePlacement(0.4, 0.62, blocker)).toBe(false);
    expect(isValidCuePlacement(0.4, 0.62, [{ ...blocker[0]!, potted: true }])).toBe(true);
  });
});
