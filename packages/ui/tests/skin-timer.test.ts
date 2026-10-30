// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Entitlements, ProductDef } from '@party/monetization';
import { createCosmeticsStore, sanitizeCosmetics } from '../src/app-shell/cosmetics.js';
import { formatLeft } from '../src/index.js';

const catalog: ProductDef[] = [
  {
    id: 'skin_noir',
    kind: 'cosmetic',
    category: 'skin',
    value: 'noir',
    titleKey: 'shop.skin_noir',
  },
  {
    id: 'skin_gold',
    kind: 'cosmetic',
    category: 'skin',
    value: 'gold',
    titleKey: 'shop.skin_gold',
  },
];
const ent = (...ids: string[]): Entitlements => ({
  noAds: false,
  cosmetics: new Set(ids),
  packs: new Set(),
});

describe('slot skin', () => {
  it('sanitizeCosmetics оставляет купленный скин, отбрасывает чужой и пустой', () => {
    expect(sanitizeCosmetics({ skin: 'noir' }, ent('skin_noir'), catalog)).toEqual({
      skin: 'noir',
    });
    expect(sanitizeCosmetics({ skin: 'noir' }, ent(), catalog)).toEqual({});
    expect(sanitizeCosmetics({ skin: 'gold' }, ent('skin_noir'), catalog)).toEqual({});
    expect(sanitizeCosmetics({ skin: '' }, ent('skin_noir'), catalog)).toEqual({});
    expect(sanitizeCosmetics({ skin: 5 }, ent('skin_noir'), catalog)).toEqual({});
  });

  it('select сохраняет скин в слот skin и не трогает остальные', async () => {
    const data = new Map<string, unknown>();
    const store = createCosmeticsStore(
      {
        loadData: async <T>(k: string) => (data.get(k) as T | undefined) ?? null,
        saveData: async (k: string, v: unknown) => void data.set(k, v),
      },
      catalog,
      () => ent('skin_noir', 'skin_gold'),
    );
    await store.select(catalog[0]!);
    expect(store.get()).toEqual({ skin: 'noir' });
    await store.select(catalog[1]!);
    expect(store.get()).toEqual({ skin: 'gold' });
    expect(data.get('cosmetics')).toEqual({ skin: 'gold' });
  });
});

describe('formatLeft', () => {
  it('меньше минуты — секунды с округлением вверх', () => {
    expect(formatLeft(59_000)).toBe('59');
    expect(formatLeft(58_001)).toBe('59');
    expect(formatLeft(1)).toBe('1');
    expect(formatLeft(0)).toBe('0');
    expect(formatLeft(-500)).toBe('0');
  });

  it('от минуты — m:ss', () => {
    expect(formatLeft(60_000)).toBe('1:00');
    expect(formatLeft(59_001)).toBe('1:00'); // «0:59» не бывает
    expect(formatLeft(65_000)).toBe('1:05');
    expect(formatLeft(300_000)).toBe('5:00');
    expect(formatLeft(299_100)).toBe('5:00');
    expect(formatLeft(125_000)).toBe('2:05');
    expect(formatLeft(599_000)).toBe('9:59');
  });
});
