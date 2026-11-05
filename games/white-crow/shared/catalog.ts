import { ownedPacks as ownedGamePacks } from '@party/monetization';
import type { Entitlements, ProductDef } from '@party/monetization';
import { SLUG } from './config.js';
import { PACKS, isPackId, type PackId } from './packs.js';

function skin(id: string, preview: string, price: number): ProductDef {
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

export const CROW_CATALOG: ProductDef[] = [
  skin('skin_feather', '\u{1FAB6}', 30),
  skin('skin_neon', '\u{1F4A1}', 35),
  skin('skin_paper', '\u{1F4DD}', 30),
  skin('skin_gold', '\u{1F451}', 50),
  pack('pack_crow_food', 'food', 50),
  pack('pack_crow_world', 'world', 50),
  pack('pack_crow_all', 'all', 80),
];

export const PEEK_PLACEMENT = 'white-crow_peek';

/** Структурно совместим с MonetizationOverride из @party/monetization. */
export const CROW_MONETIZATION = {
  web: { interstitial: { everyNthBreak: 3 } },
  yandex: { interstitial: { everyNthBreak: 3 } },
};

/** Доступные паки: бесплатные + купленные (бандл `white-crow/all` раскрывается в платные). */
export function ownedPacks(ent: Entitlements): Set<PackId> {
  return new Set([...ownedGamePacks(ent, SLUG, PACKS)].filter(isPackId));
}
