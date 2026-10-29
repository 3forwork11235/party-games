// КОНТРАКТ. Меняет только архитектор.

export type PlatformId = 'web' | 'yandex' | 'telegram' | 'capacitor';

export interface PlatformPlayer {
  /** Стабильный id на площадке; null — гость/web. */
  id: string | null;
  name: string | null;
  avatarUrl: string | null;
  isAuthorized: boolean;
}

export type AdStatus = 'shown' | 'closed' | 'error' | 'unavailable';

export interface RewardedResult {
  rewarded: boolean;
  status: AdStatus;
}

export interface CatalogItem {
  productId: string;
  title: string;
  /** Готовая к показу цена в валюте площадки, напр. "49 ₽" или "25 ⭐". */
  priceText: string;
}

export interface Purchase {
  productId: string;
  purchaseToken: string;
}

export type PurchaseResult =
  | { ok: true; purchase: Purchase }
  | { ok: false; reason: 'cancelled' | 'error' | 'unavailable' };

export interface ShareData {
  text: string;
  url: string;
}

export interface LaunchParams {
  /** Код комнаты из ссылки-приглашения (?room=, start_param, payload). */
  roomCode: string | null;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  /** Инициализация SDK. Не бросает: при недоступном SDK работает как web. */
  init(): Promise<void>;
  /** Сообщить площадке, что игра загрузилась (Yandex LoadingAPI.ready). */
  gameReady(): void;
  /** Разметка геймплея (Yandex GameplayAPI start/stop). */
  gameplayStart(): void;
  gameplayStop(): void;
  getPlayer(): Promise<PlatformPlayer>;
  /** Двухбуквенный код языка: 'ru' | 'kk' | 'en' | ... */
  getLanguage(): string;
  getLaunchParams(): LaunchParams;
  /** Собрать ссылку-приглашение в комнату для текущей площадки. */
  buildInviteUrl(roomCode: string): string;
  showInterstitial(): Promise<AdStatus>;
  showRewarded(): Promise<RewardedResult>;
  getCatalog(): Promise<CatalogItem[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  getPurchases(): Promise<Purchase[]>;
  share(data: ShareData): Promise<boolean>;
  saveData(key: string, value: unknown): Promise<void>;
  loadData<T>(key: string): Promise<T | null>;
  analytics(event: string, params?: Record<string, string | number | boolean>): void;
}
