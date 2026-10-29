// Общие типы import.meta.env для всех пакетов (без зависимости от vite/client).
interface ImportMetaEnv {
  readonly VITE_PLATFORM?: string;
  readonly VITE_SERVER_URL?: string;
  readonly VITE_YANDEX_APP_ID?: string;
  readonly VITE_YM_ID?: string;
  readonly VITE_TG_BOT?: string;
  readonly VITE_TG_APP?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
