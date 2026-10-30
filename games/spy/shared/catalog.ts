import type { ProductDef } from '@party/monetization';
import { SLUG } from './config.js';

/** Rewarded-размещение: 2-я подсказка шпиону. */
export const HINT_PLACEMENT = 'spy_hint';

function skin(id: string, price: number): ProductDef {
  return {
    id,
    kind: 'cosmetic',
    category: 'skin',
    value: id,
    starsPrice: price,
    titleKey: `shop.${id}`,
  };
}

function pack(id: string, packId: string, price: number): ProductDef {
  return {
    id,
    kind: 'pack',
    pack: { game: SLUG, packId },
    starsPrice: price,
    titleKey: `shop.${id}`,
  };
}

export const SPY_CATALOG: ProductDef[] = [
  skin('skin_dossier', 30),
  skin('skin_noir', 30),
  skin('skin_neon', 35),
  skin('skin_galaxy', 40),
  skin('skin_gold', 50),
  skin('skin_comic', 35),
  pack('pack_spy_movies', 'movies', 50),
  pack('pack_spy_space', 'space', 50),
  pack('pack_spy_history', 'history', 50),
  pack('pack_spy_all', 'all', 120),
];
