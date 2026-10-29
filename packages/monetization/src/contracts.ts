// КОНТРАКТ. Меняет только архитектор.
import type { PlatformId } from '@party/platform';

export interface InterstitialRules {
  enabled: boolean;
  /** Не чаще, чем раз в N секунд (Яндекс требует ≥ 60). */
  minIntervalSec: number;
  /** Не раньше, чем через N секунд после старта сессии. */
  firstAfterSec: number;
  /** Показывать только каждые N перерывов между раундами. */
  everyNthBreak: number;
}

export interface RewardedRules {
  enabled: boolean;
  /** Максимум наград за сессию. */
  maxPerSession: number;
}

export interface PlatformMonetizationConfig {
  interstitial: InterstitialRules;
  rewarded: RewardedRules;
  /** Разрешены ли покупки (магазин) на этой площадке. */
  purchasesEnabled: boolean;
}

export type MonetizationConfig = Record<PlatformId, PlatformMonetizationConfig>;

export type ProductKind = 'cosmetic' | 'pack' | 'no_ads';
export type CosmeticCategory = 'avatar' | 'frame' | 'nickColor' | 'effect';

export interface ProductDef {
  /** Внутренний id, он же productId на площадках. */
  id: string;
  kind: ProductKind;
  category?: CosmeticCategory; // для kind === 'cosmetic'
  /** Значение косметики: эмодзи, css-цвет, id рамки/эффекта. */
  value?: string;
  /** Для kind === 'pack': slug игры и id пака контента. */
  pack?: { game: string; packId: string };
  /** Цена в Telegram Stars (для серверного createInvoiceLink). */
  starsPrice?: number;
  /** i18n-ключ названия. */
  titleKey: string;
}

/** Что в итоге есть у игрока (вычисляется из getPurchases + локальных наград). */
export interface Entitlements {
  noAds: boolean;
  cosmetics: Set<string>; // productId
  packs: Set<string>; // `${game}/${packId}`
}
