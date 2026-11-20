import type { PlatformAdapter } from '@party/platform';

export type AimHint = 'full' | 'line' | 'off';

export interface Settings {
  soundOn: boolean;
  /** Громкость 0..1. */
  volume: number;
  aimHint: AimHint;
  vibration: boolean;
  handoff: boolean;
}

export const SETTINGS_KEY = 'eb:settings';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  soundOn: true,
  volume: 0.7,
  aimHint: 'full',
  vibration: true,
  handoff: true,
};

const HINTS: readonly AimHint[] = ['full', 'line', 'off'];

/** Любой мусор → корректные настройки: неизвестные поля — по умолчанию, громкость в 0..1. */
export function normalizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return { ...d };
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
  const vol =
    typeof r.volume === 'number' && Number.isFinite(r.volume)
      ? Math.min(1, Math.max(0, r.volume))
      : d.volume;
  const hint = HINTS.find((x) => x === r.aimHint) ?? d.aimHint;
  return {
    soundOn: bool(r.soundOn, d.soundOn),
    volume: vol,
    aimHint: hint,
    vibration: bool(r.vibration, d.vibration),
    handoff: bool(r.handoff, d.handoff),
  };
}

export interface SettingsStore {
  get(): Settings;
  set(patch: Partial<Settings>): void;
  subscribe(cb: (s: Settings) => void): () => void;
}

/** Хранилище настроек: сразу дефолты, затем подгружает сохранённые; изменения пишутся в platform. */
export function createSettings(platform: PlatformAdapter): SettingsStore {
  let cur: Settings = { ...DEFAULT_SETTINGS };
  let touched = false;
  const subs = new Set<(s: Settings) => void>();
  const emit = (): void => subs.forEach((cb) => cb(cur));
  try {
    void platform
      .loadData<unknown>(SETTINGS_KEY)
      .then((raw) => {
        if (touched || raw === null || raw === undefined) return;
        cur = normalizeSettings(raw);
        emit();
      })
      .catch(() => undefined);
  } catch {
    /* хранилище недоступно — остаются дефолты */
  }
  return {
    get: () => cur,
    set(patch) {
      touched = true;
      cur = normalizeSettings({ ...cur, ...patch });
      try {
        void platform.saveData(SETTINGS_KEY, cur).catch(() => undefined);
      } catch {
        /* не сохранилось — не критично */
      }
      emit();
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

/** Вибрация, если включена и поддерживается. */
export function vibrate(s: Settings, ms: number): void {
  if (s.vibration) navigator.vibrate?.(ms);
}
