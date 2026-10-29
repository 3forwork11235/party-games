import type { PlatformId } from '../adapter.js';
import { WebPlatform } from '../web/index.js';

/** Обёртка Capacitor: пока ведёт себя как web. */
export class CapacitorPlatform extends WebPlatform {
  override readonly id: PlatformId = 'capacitor';

  // TODO: showInterstitial/showRewarded через AdMob (@capacitor-community/admob).
  // TODO: getCatalog/purchase/getPurchases через нативный Billing (Google Play / StoreKit).
}
