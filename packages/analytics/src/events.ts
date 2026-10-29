// КОНТРАКТ. Меняет только архитектор.

export interface AnalyticsEventMap {
  game_start: { game: string; players: number };
  round_end: { game: string; round: number; durationMs: number };
  game_end: { game: string; rounds: number; players: number; durationMs: number };
  invite_sent: { game: string; channel: 'share' | 'copy' | 'qr' };
  ad_shown: { type: 'interstitial' | 'rewarded'; placement: string };
  ad_rewarded: { placement: string };
  purchase: { productId: string; platform: string };
  session_length: { seconds: number };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface AnalyticsSink {
  send(event: string, params: Record<string, string | number | boolean>): void;
}
