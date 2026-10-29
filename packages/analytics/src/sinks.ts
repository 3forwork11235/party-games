import type { AnalyticsSink } from './events.js';

/** Структурный тип адаптера платформы (без импорта @party/platform). */
export interface AnalyticsAdapterLike {
  analytics(event: string, params?: Record<string, string | number | boolean>): void;
}

export const consoleSink: AnalyticsSink = {
  send(event, params) {
    console.info('[analytics]', event, params);
  },
};

export function adapterSink(adapter: AnalyticsAdapterLike): AnalyticsSink {
  return {
    send(event, params) {
      adapter.analytics(event, params);
    },
  };
}

export function multiSink(...sinks: AnalyticsSink[]): AnalyticsSink {
  return {
    send(event, params) {
      for (const s of sinks) {
        try {
          s.send(event, params);
        } catch (err) {
          console.warn('[analytics] sink failed', err);
        }
      }
    },
  };
}
