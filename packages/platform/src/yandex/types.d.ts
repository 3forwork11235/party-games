// Минимальные типы Yandex Games SDK (только используемое).
export interface YaAdCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onRewarded?: () => void;
  onError?: (error: unknown) => void;
}

export interface YaPlayer {
  getName(): string;
  getUniqueID(): string;
  getPhoto(size: 'small' | 'medium' | 'large'): string;
  getMode?(): string;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
}

export interface YaProduct {
  id: string;
  title: string;
  price: string;
}

export interface YaPurchase {
  productID: string;
  purchaseToken: string;
}

export interface YaPayments {
  getCatalog(): Promise<YaProduct[]>;
  purchase(options: { id: string; developerPayload?: string }): Promise<YaPurchase>;
  getPurchases(): Promise<YaPurchase[]>;
}

export interface YaSdk {
  environment?: { i18n?: { lang?: string }; payload?: string };
  features?: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(options: { callbacks: YaAdCallbacks }): void;
    showRewardedVideo(options: { callbacks: YaAdCallbacks }): void;
  };
  getPlayer(options?: { scopes?: boolean }): Promise<YaPlayer>;
  getPayments(options?: { signed?: boolean }): Promise<YaPayments>;
}

export interface YaGamesGlobal {
  init(): Promise<YaSdk>;
}
