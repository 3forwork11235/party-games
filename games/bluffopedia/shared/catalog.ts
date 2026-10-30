import type { ProductDef } from '@party/monetization';
import { SLUG } from './config.js';

/** Rewarded-размещение: подсказка «убрать ложный вариант». */
export const HINT_PLACEMENT = 'bluffopedia_hint';

function font(id: string, preview: string, price: number): ProductDef {
  return {
    id,
    kind: 'cosmetic',
    category: 'skin',
    value: id,
    starsPrice: price,
    titleKey: `shop.${id}`,
    preview,
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

export const BLUFF_CATALOG: ProductDef[] = [
  font('font_typewriter', '⌨️', 30),
  font('font_handwritten', '✍️', 30),
  font('font_storybook', '\u{1F4D6}', 30),
  font('font_neon', '\u{1F4A1}', 40),
  font('font_poster', '\u{1F4E2}', 35),
  font('font_pixel', '\u{1F47E}', 40),
  pack('pack_bluff_laws', 'laws', 50),
  pack('pack_bluff_records', 'records', 50),
  pack('pack_bluff_all', 'all', 80),
];
