import { createMenu, type Menu } from './menu.js';
import { createSettings, vibrate, type SettingsStore } from './settings.js';
import type { Sound } from './sound.js';
import type { BilliardsCtx } from './types.js';

export interface Prefs {
  settings: SettingsStore;
  menu: Menu;
  buzz(ms: number): void;
  destroy(): void;
}

/** Настройки + меню; применяет громкость к звуку. */
export function createPrefs(ctx: BilliardsCtx, sound: Sound): Prefs {
  const settings = createSettings(ctx.platform);
  const apply = (): void => {
    const st = settings.get();
    sound.setVolume(st.soundOn ? st.volume : 0);
  };
  apply();
  const off = settings.subscribe(apply);
  const menu = createMenu(ctx, settings);
  return {
    settings,
    menu,
    buzz: (ms) => vibrate(settings.get(), ms),
    destroy() {
      off();
      menu.destroy();
    },
  };
}
