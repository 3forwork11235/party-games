import type {
  AdStatus,
  CatalogItem,
  LaunchParams,
  PlatformAdapter,
  PlatformId,
  PlatformPlayer,
  Purchase,
  PurchaseResult,
  RewardedResult,
  ShareData,
} from '../adapter.js';
import { showAdOverlay } from './adOverlay.js';
import { localLoad, localSave, parseProfile } from './storage.js';

const PURCHASES_KEY = 'purchases';

export class WebPlatform implements PlatformAdapter {
  readonly id: PlatformId = 'web';
  /** `?profile=<id>` на момент создания адаптера; null — прежние ключи хранилища. */
  protected readonly profile: string | null;

  constructor() {
    this.profile = parseProfile(globalThis.location?.search ?? '');
  }

  init(): Promise<void> {
    return Promise.resolve();
  }
  gameReady(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}

  getPlayer(): Promise<PlatformPlayer> {
    return Promise.resolve({ id: null, name: null, avatarUrl: null, isAuthorized: false });
  }

  getLanguage(): string {
    const raw = typeof navigator === 'undefined' ? '' : navigator.language;
    const code = raw.slice(0, 2).toLowerCase();
    return code.length === 2 ? code : 'en';
  }

  getLaunchParams(): LaunchParams {
    const room = new URLSearchParams(globalThis.location?.search ?? '').get('room');
    return { roomCode: room && room.length > 0 ? room : null };
  }

  buildInviteUrl(roomCode: string): string {
    const { origin, pathname } = globalThis.location;
    return `${origin}${pathname}?room=${encodeURIComponent(roomCode)}`;
  }

  async showInterstitial(): Promise<AdStatus> {
    await showAdOverlay();
    return 'shown';
  }

  async showRewarded(): Promise<RewardedResult> {
    await showAdOverlay();
    return { rewarded: true, status: 'shown' };
  }

  getCatalog(): Promise<CatalogItem[]> {
    return Promise.resolve([]);
  }

  purchase(productId: string): Promise<PurchaseResult> {
    const list = localLoad<Purchase[]>(PURCHASES_KEY, this.profile) ?? [];
    const purchase: Purchase = { productId, purchaseToken: `stub-${Date.now()}` };
    localSave(PURCHASES_KEY, [...list, purchase], this.profile);
    return Promise.resolve({ ok: true, purchase });
  }

  getPurchases(): Promise<Purchase[]> {
    return Promise.resolve(localLoad<Purchase[]>(PURCHASES_KEY, this.profile) ?? []);
  }

  async share(data: ShareData): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text: data.text, url: data.url });
        return true;
      }
      await navigator.clipboard.writeText(`${data.text} ${data.url}`.trim());
      return true;
    } catch {
      return false;
    }
  }

  saveData(key: string, value: unknown): Promise<void> {
    localSave(key, value, this.profile);
    return Promise.resolve();
  }

  loadData<T>(key: string): Promise<T | null> {
    return Promise.resolve(localLoad<T>(key, this.profile));
  }

  analytics(event: string, params?: Record<string, string | number | boolean>): void {
    console.info('[analytics]', event, params);
  }
}
