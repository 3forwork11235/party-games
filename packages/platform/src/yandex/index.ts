import type {
  AdStatus,
  CatalogItem,
  LaunchParams,
  PlatformId,
  PlatformPlayer,
  Purchase,
  PurchaseResult,
  RewardedResult,
} from '../adapter.js';
import { WebPlatform } from '../web/index.js';
import { localLoad, localSave } from '../web/storage.js';
import type { YaGamesGlobal, YaPayments, YaPlayer, YaSdk } from './types.js';

interface YandexWindow {
  YaGames?: YaGamesGlobal;
  ym?: (id: string | number, method: string, event: string, params?: unknown) => void;
}

const win = (): YandexWindow => globalThis as unknown as YandexWindow;

export class YandexPlatform extends WebPlatform {
  override readonly id: PlatformId = 'yandex';
  private sdk: YaSdk | null = null;
  private player: YaPlayer | null = null;
  private payments: YaPayments | null = null;

  override async init(): Promise<void> {
    const ya = win().YaGames;
    if (!ya) {
      console.warn('[platform] YaGames не найден, работаем как web');
      return;
    }
    try {
      this.sdk = await ya.init();
    } catch (e) {
      console.warn('[platform] YaGames.init не удался, работаем как web', e);
    }
  }

  override gameReady(): void {
    this.sdk?.features?.LoadingAPI?.ready();
  }
  override gameplayStart(): void {
    this.sdk?.features?.GameplayAPI?.start();
  }
  override gameplayStop(): void {
    this.sdk?.features?.GameplayAPI?.stop();
  }

  private async ensurePlayer(): Promise<YaPlayer | null> {
    if (this.player) return this.player;
    if (!this.sdk) return null;
    try {
      this.player = await this.sdk.getPlayer({ scopes: false });
    } catch {
      this.player = null;
    }
    return this.player;
  }

  override async getPlayer(): Promise<PlatformPlayer> {
    const p = await this.ensurePlayer();
    if (!p) return super.getPlayer();
    const authorized = p.getMode?.() !== 'lite';
    return {
      id: authorized ? p.getUniqueID() || null : null,
      name: authorized ? p.getName() || null : null,
      avatarUrl: authorized ? p.getPhoto('medium') || null : null,
      isAuthorized: authorized,
    };
  }

  override getLanguage(): string {
    return this.sdk?.environment?.i18n?.lang?.slice(0, 2).toLowerCase() || super.getLanguage();
  }

  override getLaunchParams(): LaunchParams {
    if (!this.sdk) return super.getLaunchParams();
    const payload = this.sdk.environment?.payload;
    return { roomCode: payload ? payload : null };
  }

  override buildInviteUrl(roomCode: string): string {
    const appId = import.meta.env.VITE_YANDEX_APP_ID;
    if (!appId) return super.buildInviteUrl(roomCode);
    return `https://yandex.ru/games/app/${appId}?payload=${encodeURIComponent(roomCode)}`;
  }

  override showInterstitial(): Promise<AdStatus> {
    const sdk = this.sdk;
    if (!sdk) return super.showInterstitial();
    return new Promise((resolve) => {
      try {
        sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: (wasShown) => resolve(wasShown ? 'shown' : 'closed'),
            onError: () => resolve('error'),
          },
        });
      } catch {
        resolve('error');
      }
    });
  }

  override showRewarded(): Promise<RewardedResult> {
    const sdk = this.sdk;
    if (!sdk) return super.showRewarded();
    return new Promise((resolve) => {
      let rewarded = false;
      try {
        sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => resolve({ rewarded, status: rewarded ? 'shown' : 'closed' }),
            onError: () => resolve({ rewarded: false, status: 'error' }),
          },
        });
      } catch {
        resolve({ rewarded: false, status: 'error' });
      }
    });
  }

  private async ensurePayments(): Promise<YaPayments | null> {
    if (this.payments) return this.payments;
    if (!this.sdk) return null;
    try {
      this.payments = await this.sdk.getPayments();
    } catch {
      this.payments = null;
    }
    return this.payments;
  }

  override async getCatalog(): Promise<CatalogItem[]> {
    if (!this.sdk) return super.getCatalog();
    const pay = await this.ensurePayments();
    if (!pay) return [];
    try {
      const items = await pay.getCatalog();
      return items.map((i) => ({ productId: i.id, title: i.title, priceText: i.price }));
    } catch {
      return [];
    }
  }

  override async purchase(productId: string): Promise<PurchaseResult> {
    if (!this.sdk) return super.purchase(productId);
    const pay = await this.ensurePayments();
    if (!pay) return { ok: false, reason: 'unavailable' };
    try {
      const p = await pay.purchase({ id: productId });
      return { ok: true, purchase: { productId: p.productID, purchaseToken: p.purchaseToken } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: /cancel/i.test(msg) ? 'cancelled' : 'error' };
    }
  }

  override async getPurchases(): Promise<Purchase[]> {
    if (!this.sdk) return super.getPurchases();
    const pay = await this.ensurePayments();
    if (!pay) return [];
    try {
      const list = await pay.getPurchases();
      return list.map((p) => ({ productId: p.productID, purchaseToken: p.purchaseToken }));
    } catch {
      return [];
    }
  }

  override async saveData(key: string, value: unknown): Promise<void> {
    const p = await this.ensurePlayer();
    if (p) {
      try {
        await p.setData({ [key]: value });
        return;
      } catch {
        /* fallback ниже */
      }
    }
    localSave(key, value, this.profile);
  }

  override async loadData<T>(key: string): Promise<T | null> {
    const p = await this.ensurePlayer();
    if (p) {
      try {
        const data = await p.getData([key]);
        if (data[key] !== undefined) return data[key] as T;
      } catch {
        /* fallback ниже */
      }
    }
    return localLoad<T>(key, this.profile);
  }

  override analytics(event: string, params?: Record<string, string | number | boolean>): void {
    const ym = win().ym;
    const id = import.meta.env.VITE_YM_ID;
    if (typeof ym === 'function' && id) {
      ym(id, 'reachGoal', event, params);
      return;
    }
    super.analytics(event, params);
  }
}
