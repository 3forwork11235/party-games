import type { PartyClient } from '@party/core/client';
import { MSG_HELLO, MSG_YOU, type YouMessage } from '../shared/messages.js';

/** Пауза перед первым `bluffopedia:hello`, если `you` не пришёл вместе со стадией. */
export const HELLO_GRACE_MS = 700;
/** Не чаще одного `bluffopedia:hello` за этот интервал. */
export const HELLO_GAP_MS = 2000;

type Net = Pick<PartyClient, 'onGame' | 'sendGame'>;

export interface YouTracker {
  /** Последнее `you`, присланное для раунда `round`, иначе null. */
  get(round: number): YouMessage | null;
  /** Вызывать на каждом снимке: при отсутствии данных в round запрашивает их у сервера. */
  sync(state: { phase: string; round: number }): void;
  destroy(): void;
}

/** Проверка и нормализация `bluffopedia:you` с сервера. */
export function parseYou(raw: unknown): YouMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.round !== 'number') return null;
  return {
    round: m.round,
    lie: typeof m.lie === 'string' ? m.lie : '',
    ownId: typeof m.ownId === 'string' ? m.ownId : '',
    hintId: typeof m.hintId === 'string' ? m.hintId : '',
  };
}

/**
 * Хранит последнее `bluffopedia:you`. Шлёт `hello` при создании и, если в round нет данных
 * для текущего раунда, повторяет запрос не чаще раза в HELLO_GAP_MS.
 */
export function createYouTracker(
  net: Net,
  onChange: () => void,
  now: () => number = Date.now,
): YouTracker {
  let you: YouMessage | null = null;
  let last: { phase: string; round: number } | null = null;
  let lastHello = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hello = (): void => {
    lastHello = now();
    net.sendGame(MSG_HELLO, {});
  };
  const missing = (): boolean => last?.phase === 'round' && you?.round !== last.round;
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

  const off = net.onGame<unknown>(MSG_YOU, (raw) => {
    const next = parseYou(raw);
    if (!next || (you && next.round < you.round)) return;
    you = next;
    onChange();
  });
  hello();

  return {
    get: (round) => (you && you.round === round ? you : null),
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
