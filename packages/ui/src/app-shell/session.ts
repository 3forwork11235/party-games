import type { PlatformAdapter } from '@party/platform';

export interface Profile {
  playerId: string;
  nick: string;
  avatar: string;
}

const KEY = 'profile';

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Загружает профиль игрока или создаёт новый (playerId стабилен между сессиями). */
export async function loadProfile(platform: PlatformAdapter): Promise<Profile> {
  const saved = await platform.loadData<Partial<Profile>>(KEY).catch(() => null);
  const profile: Profile = {
    playerId: typeof saved?.playerId === 'string' && saved.playerId ? saved.playerId : uuid(),
    nick: typeof saved?.nick === 'string' ? saved.nick : '',
    avatar: typeof saved?.avatar === 'string' ? saved.avatar : '',
  };
  if (!saved?.playerId) await saveProfile(platform, profile);
  return profile;
}

export async function saveProfile(platform: PlatformAdapter, profile: Profile): Promise<void> {
  try {
    await platform.saveData(KEY, profile);
  } catch {
    /* хранилище недоступно — не критично */
  }
}

/** Цвета рамок аватара (id из FRAMES → css). */
export const FRAME_COLORS: Record<string, string> = {
  none: 'transparent',
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  neon: '#39ff14',
  rainbow: '#b57cff',
};
