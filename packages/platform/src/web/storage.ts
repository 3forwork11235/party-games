const PREFIX = 'party:data:';

/**
 * Профиль из `?profile=<id>`: 1–8 символов `[a-z0-9]`, иначе null.
 * Нужен, чтобы несколько вкладок одного origin вели себя как разные игроки.
 */
export function parseProfile(search: string): string | null {
  const id = new URLSearchParams(search).get('profile');
  return id !== null && /^[a-z0-9]{1,8}$/.test(id) ? id : null;
}

/** Полный ключ localStorage: `party:data:[<profile>:]<key>`. */
export function storageKey(key: string, profile: string | null = null): string {
  return profile ? `${PREFIX}${profile}:${key}` : PREFIX + key;
}

export function localSave(key: string, value: unknown, profile: string | null = null): void {
  try {
    localStorage.setItem(storageKey(key, profile), JSON.stringify(value));
  } catch {
    /* хранилище недоступно или переполнено */
  }
}

export function localLoad<T>(key: string, profile: string | null = null): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key, profile));
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}
