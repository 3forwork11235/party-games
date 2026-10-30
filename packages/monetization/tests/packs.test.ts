import { describe, expect, it } from 'vitest';
import { ownedPacks, type Entitlements } from '../src/index.js';

const packs = [
  { id: 'city', free: true },
  { id: 'movies', free: false },
  { id: 'space', free: false },
];
const ent = (...bought: string[]): Entitlements => ({
  noAds: false,
  cosmetics: new Set(),
  packs: new Set(bought),
});

describe('ownedPacks', () => {
  it('без покупок — только бесплатные', () => {
    expect([...ownedPacks(ent(), 'spy', packs)]).toEqual(['city']);
  });

  it('купленный пак открывается, чужой игры — нет', () => {
    expect([...ownedPacks(ent('spy/movies'), 'spy', packs)].sort()).toEqual(['city', 'movies']);
    expect(ownedPacks(ent('other/movies'), 'spy', packs).has('movies')).toBe(false);
  });

  it('бандл game/all открывает все паки', () => {
    expect([...ownedPacks(ent('spy/all'), 'spy', packs)].sort()).toEqual([
      'city',
      'movies',
      'space',
    ]);
    expect(ownedPacks(ent('other/all'), 'spy', packs).size).toBe(1);
  });
});
