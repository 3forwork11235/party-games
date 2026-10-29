import type { MonetizationConfig } from './contracts.js';

/**
 * Правила монетизации по площадкам. Отдельные игры могут переопределять значения.
 */
export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  // Web (itch.io / свой хост): мягкая реклама, лимит от спама.
  web: {
    interstitial: { enabled: true, minIntervalSec: 30, firstAfterSec: 0, everyNthBreak: 1 },
    rewarded: { enabled: true, maxPerSession: 10 },
    purchasesEnabled: true,
  },
  // Яндекс Игры: межстраничная не чаще раза в 60 с (требование модерации),
  // первая — не в первые секунды сессии, чтобы не мешать входу в игру.
  yandex: {
    interstitial: { enabled: true, minIntervalSec: 60, firstAfterSec: 30, everyNthBreak: 1 },
    rewarded: { enabled: true, maxPerSession: 20 },
    purchasesEnabled: true,
  },
  // Telegram Mini Apps: рекламного SDK в базовой интеграции нет; покупки — Telegram Stars.
  telegram: {
    interstitial: { enabled: false, minIntervalSec: 0, firstAfterSec: 0, everyNthBreak: 1 },
    rewarded: { enabled: false, maxPerSession: 0 },
    purchasesEnabled: true,
  },
  // Нативные приложения: реклама и покупки отключены до подключения нативных SDK и ревью сторов.
  capacitor: {
    interstitial: { enabled: false, minIntervalSec: 0, firstAfterSec: 0, everyNthBreak: 1 },
    rewarded: { enabled: false, maxPerSession: 0 },
    purchasesEnabled: false,
  },
};
