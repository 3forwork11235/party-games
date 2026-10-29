import type {
  AdStatus,
  CatalogItem,
  LaunchParams,
  PlatformId,
  PlatformPlayer,
  Purchase,
  PurchaseResult,
  RewardedResult,
  ShareData,
} from '../adapter.js';
import { WebPlatform } from '../web/index.js';
import { localLoad, localSave } from '../web/storage.js';
import type { TgCloudStorage, TgGlobal, TgWebApp } from './types.js';

const MAX_CLOUD_VALUE = 4096;

const tgGlobal = (): TgGlobal | undefined =>
  (globalThis as unknown as { Telegram?: TgGlobal }).Telegram;

const cloudKey = (key: string): string => key.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);

function isPurchase(v: unknown): v is Purchase {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.productId === 'string' && typeof o.purchaseToken === 'string';
}

export class TelegramPlatform extends WebPlatform {
  override readonly id: PlatformId = 'telegram';
  private app: TgWebApp | null = null;

  override init(): Promise<void> {
    const app = tgGlobal()?.WebApp;
    if (!app) {
      console.warn('[platform] Telegram.WebApp не найден, работаем как web');
      return Promise.resolve();
    }
    this.app = app;
    app.ready();
    app.expand();
    app.disableVerticalSwipes?.();
    return Promise.resolve();
  }

  override getPlayer(): Promise<PlatformPlayer> {
    const user = this.app?.initDataUnsafe.user;
    if (!user) return super.getPlayer();
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return Promise.resolve({
      id: String(user.id),
      name: name || user.username || null,
      avatarUrl: user.photo_url ?? null,
      isAuthorized: true,
    });
  }

  override getLanguage(): string {
    const lc = this.app?.initDataUnsafe.user?.language_code;
    return lc ? lc.slice(0, 2).toLowerCase() : super.getLanguage();
  }

  override getLaunchParams(): LaunchParams {
    if (!this.app) return super.getLaunchParams();
    const sp = this.app.initDataUnsafe.start_param;
    return { roomCode: sp ? sp : null };
  }

  override buildInviteUrl(roomCode: string): string {
    const bot = import.meta.env.VITE_TG_BOT;
    const app = import.meta.env.VITE_TG_APP;
    if (!bot || !app) return super.buildInviteUrl(roomCode);
    return `https://t.me/${bot}/${app}?startapp=${encodeURIComponent(roomCode)}`;
  }

  override async share(data: ShareData): Promise<boolean> {
    if (!this.app) return super.share(data);
    const link = `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;
    this.app.openTelegramLink(link);
    return true;
  }

  override showInterstitial(): Promise<AdStatus> {
    return Promise.resolve('unavailable');
  }

  override showRewarded(): Promise<RewardedResult> {
    return Promise.resolve({ rewarded: false, status: 'unavailable' });
  }

  override getCatalog(): Promise<CatalogItem[]> {
    // Цены в Stars берутся из каталога @party/monetization (starsPrice).
    return Promise.resolve([]);
  }

  override async purchase(productId: string): Promise<PurchaseResult> {
    const app = this.app;
    const api = import.meta.env.VITE_API_URL;
    if (!app || api === undefined) return { ok: false, reason: 'unavailable' };
    let link: string;
    try {
      const res = await fetch(`${api}/api/tg/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, initData: app.initData }),
      });
      if (!res.ok) return { ok: false, reason: 'error' };
      const body = (await res.json()) as { invoiceLink?: unknown };
      if (typeof body.invoiceLink !== 'string') return { ok: false, reason: 'error' };
      link = body.invoiceLink;
    } catch {
      return { ok: false, reason: 'error' };
    }
    return new Promise((resolve) => {
      app.openInvoice(link, (status) => {
        if (status === 'paid') {
          resolve({ ok: true, purchase: { productId, purchaseToken: link } });
        } else {
          resolve({ ok: false, reason: status === 'cancelled' ? 'cancelled' : 'error' });
        }
      });
    });
  }

  override async getPurchases(): Promise<Purchase[]> {
    const app = this.app;
    const api = import.meta.env.VITE_API_URL;
    if (!app || api === undefined) return [];
    try {
      const res = await fetch(
        `${api}/api/tg/purchases?initData=${encodeURIComponent(app.initData)}`,
      );
      if (!res.ok) return [];
      const body = (await res.json()) as unknown;
      const list =
        typeof body === 'object' && body !== null && 'purchases' in body
          ? (body as { purchases: unknown }).purchases
          : body;
      return Array.isArray(list) ? list.filter(isPurchase) : [];
    } catch {
      return [];
    }
  }

  private cloud(): TgCloudStorage | null {
    return this.app?.CloudStorage ?? null;
  }

  override saveData(key: string, value: unknown): Promise<void> {
    const cloud = this.cloud();
    const json = JSON.stringify(value);
    if (!cloud || json === undefined || json.length > MAX_CLOUD_VALUE) {
      localSave(key, value);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      cloud.setItem(cloudKey(key), json, (err) => {
        if (err) localSave(key, value);
        resolve();
      });
    });
  }

  override loadData<T>(key: string): Promise<T | null> {
    const cloud = this.cloud();
    if (!cloud) return Promise.resolve(localLoad<T>(key));
    return new Promise((resolve) => {
      cloud.getItem(cloudKey(key), (err, value) => {
        if (!err && value) {
          try {
            resolve(JSON.parse(value) as T);
            return;
          } catch {
            /* fallback ниже */
          }
        }
        resolve(localLoad<T>(key));
      });
    });
  }
}
