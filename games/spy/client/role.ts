import type { PartyClient } from '@party/core/client';
import { MSG_HELLO, MSG_ROLE, type SpyRoleMessage } from '../shared/messages.js';

/** Пауза перед первым `spy:hello`, если роль не пришла вместе со стартом раунда. */
export const HELLO_GRACE_MS = 700;
/** Не чаще одного `spy:hello` за этот интервал. */
export const HELLO_GAP_MS = 2000;

type Net = Pick<PartyClient, 'onGame' | 'sendGame'>;

export interface RoleTracker {
  /** Роль, присланная для раунда `round`, иначе null. */
  get(round: number): SpyRoleMessage | null;
  /** Вызывать на каждом снимке состояния: при отсутствии роли в round запрашивает её у сервера. */
  sync(state: { phase: string; round: number }): void;
  destroy(): void;
}

/** Проверка и нормализация `spy:role` с сервера. */
export function parseRole(raw: unknown): SpyRoleMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.round !== 'number' || typeof m.spy !== 'boolean') return null;
  const crossed = Array.isArray(m.crossed)
    ? m.crossed.filter((x): x is string => typeof x === 'string')
    : [];
  const role: SpyRoleMessage = {
    round: m.round,
    spy: m.spy,
    crossed,
    hintsLeft: typeof m.hintsLeft === 'number' ? m.hintsLeft : 0,
  };
  if (typeof m.locationId === 'string') role.locationId = m.locationId;
  if (typeof m.roleIndex === 'number') role.roleIndex = m.roleIndex;
  return role;
}

/**
 * Хранит последнюю роль (`spy:role`). Шлёт `spy:hello` при создании и, если в round нет роли
 * для текущего раунда, повторяет запрос не чаще раза в HELLO_GAP_MS.
 */
export function createRoleTracker(
  net: Net,
  onChange: () => void,
  now: () => number = Date.now,
): RoleTracker {
  let role: SpyRoleMessage | null = null;
  let last: { phase: string; round: number } | null = null;
  let lastHello = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hello = (): void => {
    lastHello = now();
    net.sendGame(MSG_HELLO, {});
  };
  const missing = (): boolean => last?.phase === 'round' && role?.round !== last.round;
  const stopTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const check = (): void => {
    timer = undefined;
    if (!missing()) return;
    if (now() - lastHello >= HELLO_GAP_MS) hello();
    timer = setTimeout(check, HELLO_GAP_MS);
  };

  const off = net.onGame<unknown>(MSG_ROLE, (raw) => {
    const next = parseRole(raw);
    if (!next || (role && next.round < role.round)) return;
    role = next;
    onChange();
  });
  hello();

  return {
    get: (round) => (role && role.round === round ? role : null),
    sync(state) {
      last = state;
      if (!missing()) stopTimer();
      else timer ??= setTimeout(check, HELLO_GRACE_MS);
    },
    destroy() {
      off();
      stopTimer();
    },
  };
}
