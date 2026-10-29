// Минимальные типы Telegram WebApp (только используемое).
export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TgCloudStorage {
  setItem(key: string, value: string, cb?: (err: string | null, stored?: boolean) => void): void;
  getItem(key: string, cb: (err: string | null, value?: string) => void): void;
}

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string };
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  openTelegramLink(url: string): void;
  openInvoice(
    url: string,
    cb?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void,
  ): void;
  CloudStorage?: TgCloudStorage;
}

export interface TgGlobal {
  WebApp?: TgWebApp;
}
