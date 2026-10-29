import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TgUser {
  id: number;
  language_code?: string;
}

export interface InitDataResult {
  user: TgUser;
  authDate: number;
}

/**
 * Проверка Telegram WebApp initData
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Возвращает данные пользователя или null, если подпись неверна / данные устарели.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  opts: { maxAgeSec?: number; nowSec?: number } = {},
): InitDataResult | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  const actual = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  const maxAge = opts.maxAgeSec ?? 86400;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (maxAge > 0 && now - authDate > maxAge) return null;

  const rawUser = params.get('user');
  if (!rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as unknown;
    if (typeof user !== 'object' || user === null) return null;
    if (typeof (user as { id?: unknown }).id !== 'number') return null;
    return { user: user as TgUser, authDate };
  } catch {
    return null;
  }
}
