import type { PartyClient } from '@party/core/client';
import { MSG_HELLO, MSG_YOU, type YouMessage } from '../shared/messages.js';

/** Не чаще одного `white-crow:hello` за этот интервал. */
export const HELLO_GAP_MS = 2000;

type Net = Pick<PartyClient, 'onGame' | 'sendGame'>;

export interface YouTracker {
  /** Последнее `you` для раунда `round`, иначе null. */
  get(round: number): YouMessage | null;
  /** Вызывать на каждом снимке: при отсутствии данных в round запрашивает их у сервера. */
  sync(state: { phase: string; round: number }): void;
  destroy(): void;
}

export function parseYou(raw: unknown): YouMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.round !== 'number') return null;
  return {
    round: m.round,
    option: typeof m.option === 'number' ? m.option : -1,
    peek: Array.isArray(m.peek) ? m.peek.filter((x): x is number => typeof x === 'number') : [],
  };
}

/** Хранит последнее `you`; шлёт `hello` при создании и если в round нет данных для раунда. */
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
      else timer ??= setTimeout(check, 300);
    },
    destroy() {
      off();
      stopTimer();
    },
  };
}
