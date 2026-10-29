import type { CosmeticCategory, ProductDef } from './contracts.js';

function cosmetic(
  id: string,
  category: CosmeticCategory,
  value: string,
  starsPrice: number,
): ProductDef {
  return { id, kind: 'cosmetic', category, value, starsPrice, titleKey: `shop.${id}` };
}

export const DEFAULT_CATALOG: ProductDef[] = [
  cosmetic('avatar_alien', 'avatar', '👽', 15),
  cosmetic('avatar_dino', 'avatar', '🦖', 15),
  cosmetic('avatar_robot', 'avatar', '🤖', 25),
  cosmetic('avatar_dragon', 'avatar', '🐲', 40),
  cosmetic('frame_gold', 'frame', 'gold', 30),
  cosmetic('frame_neon', 'frame', 'neon', 30),
  cosmetic('frame_rainbow', 'frame', 'rainbow', 50),
  cosmetic('nick_red', 'nickColor', 'red', 10),
  cosmetic('nick_cyan', 'nickColor', 'cyan', 10),
  cosmetic('nick_gold', 'nickColor', 'gold', 20),
  cosmetic('effect_confetti', 'effect', 'confetti', 35),
  cosmetic('effect_sparkles', 'effect', 'sparkles', 35),
  { id: 'no_ads', kind: 'no_ads', starsPrice: 100, titleKey: 'shop.no_ads' },
  {
    id: 'pack_example',
    kind: 'pack',
    pack: { game: 'example', packId: 'extra' },
    starsPrice: 50,
    titleKey: 'shop.pack_example',
  },
];
