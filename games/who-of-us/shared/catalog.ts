import { ownedPacks as ownedGamePacks } from '@party/monetization';
import type { Entitlements, ProductDef } from '@party/monetization';
import { SLUG } from './config.js';
import { PACKS, isPackId, type PackId } from './packs.js';

function cosmetic(
  id: string,
  category: 'frame' | 'effect',
  value: string,
  price: number,
): ProductDef {
  return { id, kind: 'cosmetic', category, value, starsPrice: price, titleKey: `shop.${id}` };
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

export const WOU_CATALOG: ProductDef[] = [
  cosmetic('frame_crown', 'frame', 'crown', 40),
  cosmetic('frame_hearts', 'frame', 'hearts', 40),
  cosmetic('reveal_drumroll', 'effect', 'reveal_drumroll', 35),
  cosmetic('reveal_spotlight', 'effect', 'reveal_spotlight', 35),
  cosmetic('reveal_fireworks', 'effect', 'reveal_fireworks', 35),
  pack('pack_wou_work', 'work', 50),
  pack('pack_wou_absurd', 'absurd', 50),
  pack('pack_wou_party', 'party', 50),
  pack('pack_wou_all', 'all', 120),
];

/** Структурно совместим с MonetizationOverride из @party/monetization. */
export const WOU_MONETIZATION = {
  web: { interstitial: { everyNthBreak: 5 } },
  yandex: { interstitial: { everyNthBreak: 5 } },
};

/** Доступные паки: бесплатные + купленные (бандл `who-of-us/all` раскрывается в платные). */
export function ownedPacks(ent: Entitlements): Set<PackId> {
  return new Set([...ownedGamePacks(ent, SLUG, PACKS)].filter(isPackId));
}
