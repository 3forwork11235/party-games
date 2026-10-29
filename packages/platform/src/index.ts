import type { PlatformAdapter } from './adapter.js';

export type * from './adapter.js';

/**
 * Создаёт адаптер текущей площадки по VITE_PLATFORM (web по умолчанию).
 * Статические if-ветки с dynamic import позволяют Vite вырезать чужие адаптеры.
 */
export async function createPlatform(): Promise<PlatformAdapter> {
  const platform = import.meta.env.VITE_PLATFORM ?? 'web';
  let adapter: PlatformAdapter;
  if (platform === 'yandex') {
    const m = await import('./yandex/index.js');
    adapter = new m.YandexPlatform();
  } else if (platform === 'telegram') {
    const m = await import('./telegram/index.js');
    adapter = new m.TelegramPlatform();
  } else if (platform === 'capacitor') {
    const m = await import('./capacitor/index.js');
    adapter = new m.CapacitorPlatform();
  } else {
    const m = await import('./web/index.js');
    adapter = new m.WebPlatform();
  }
  await adapter.init();
  return adapter;
}
