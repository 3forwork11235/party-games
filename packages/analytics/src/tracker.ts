import type { AnalyticsEventMap, AnalyticsEventName, AnalyticsSink } from './events.js';

export interface TrackerOptions {
  sink: AnalyticsSink;
  /** Источник времени в мс; по умолчанию Date.now. */
  now?: () => number;
}

export interface Tracker {
  track<K extends AnalyticsEventName>(name: K, params: AnalyticsEventMap[K]): void;
  /**
   * Начинает отсчёт сессии. `session_length` отправляется при pagehide / visibilitychange→hidden;
   * после возврата на страницу отсчёт идёт заново и отправляется только прирост.
   */
  startSession(): void;
}

export function createTracker(opts: TrackerOptions): Tracker {
  const { sink } = opts;
  const now = opts.now ?? ((): number => Date.now());
  let mark: number | null = null;
  let started = false;

  const flush = (): void => {
    if (mark === null) return;
    const seconds = Math.round((now() - mark) / 1000);
    mark = null;
    if (seconds > 0) sink.send('session_length', { seconds });
  };

  return {
    track(name, params) {
      sink.send(name, { ...params });
    },
    startSession() {
      if (started) return;
      started = true;
      mark = now();
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
        else if (mark === null) mark = now();
      });
    },
  };
}
