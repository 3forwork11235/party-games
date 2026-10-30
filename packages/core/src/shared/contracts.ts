// КОНТРАКТ. Меняет только архитектор.

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export interface Cosmetics {
  frame?: string;
  nickColor?: string;
  effect?: string;
  /** Скин главного элемента игры (карточка, поле); виден только владельцу, на сервер не нужен. */
  skin?: string;
}

/** Передаётся в options при create/join. */
export interface JoinOptions {
  playerId: string; // UUID, хранится на клиенте через PlatformAdapter.saveData
  nick: string; // 1..16 символов после trim, сервер обрезает/санитизирует
  avatar: string; // один эмодзи из AVATARS (packages/core/src/shared/avatars.ts)
  lang: string;
  cosmetics?: Cosmetics;
}

/** Базовые фазы. Порядок: lobby → countdown → round → roundEnd → (adBreak → countdown …) → results → lobby */
export type CorePhase = 'lobby' | 'countdown' | 'round' | 'roundEnd' | 'adBreak' | 'results';

export interface GameConfig {
  slug: string;
  minPlayers: number; // ≥ 2
  maxPlayers: number; // ≤ 10
  rounds: number;
  countdownMs: number;
  roundMs: number; // максимальная длительность раунда
  roundEndMs: number; // показ результатов раунда
  adBreakMinMs: number; // пауза между раундами, даже без рекламы
  adBreakMaxMs: number; // не ждать дольше, даже если кто-то смотрит рекламу
  reconnectSec: number; // окно allowReconnection
  idleKickSec: number; // кик за отсутствие сообщений в фазе lobby/round
}

export const DEFAULT_GAME_CONFIG: Omit<GameConfig, 'slug'> = {
  minPlayers: 2,
  maxPlayers: 8,
  rounds: 3,
  countdownMs: 3000,
  roundMs: 20000,
  roundEndMs: 4000,
  adBreakMinMs: 1500,
  adBreakMaxMs: 30000,
  reconnectSec: 60,
  idleKickSec: 180,
};

/** Поля состояния. Schema-классы в server/ обязаны иметь ровно эти имена полей. */
export interface IPlayer {
  id: string; // playerId (не sessionId)
  sessionId: string;
  nick: string;
  avatar: string;
  frame: string;
  nickColor: string;
  score: number;
  roundScore: number;
  connected: boolean;
  ready: boolean;
}

export interface ICoreState {
  code: string;
  phase: CorePhase;
  phaseEndsAt: number; // epoch ms (серверное время), 0 — без таймера
  round: number; // 1-based, 0 в лобби
  totalRounds: number;
  hostId: string; // playerId хоста
  players: Map<string, IPlayer>; // ключ — playerId
}

/** Сообщения клиент → сервер (core). Игровые сообщения — с префиксом `<slug>:`. */
export interface ClientMessages {
  'core:ready': { ready: boolean };
  'core:start': Record<string, never>; // только хост, в lobby, при ≥ minPlayers
  'core:kick': { playerId: string }; // только хост
  'core:chat': { text: string }; // 1..200 символов
  'core:adDone': Record<string, never>; // клиент закончил рекламную паузу
  'core:restart': Record<string, never>; // только хост, в results → lobby
}

/** Сообщения сервер → клиент (core). */
export interface ServerMessages {
  'core:chat': { playerId: string; nick: string; text: string; ts: number };
  'core:toast': { key: string; params?: Record<string, string | number> }; // i18n-ключ
  'core:kicked': { reason: 'host' | 'idle' | 'flood' };
  'core:time': { serverNow: number }; // для синхронизации таймеров
}

export interface RateLimitConfig {
  /** token bucket: ёмкость и пополнение в секунду, общие на все сообщения клиента */
  capacity: number;
  refillPerSec: number;
  /** чат отдельно */
  chatCapacity: number;
  chatRefillPerSec: number;
  /** столько нарушений подряд → кик с reason 'flood' */
  maxViolations: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  capacity: 40,
  refillPerSec: 25,
  chatCapacity: 3,
  chatRefillPerSec: 0.5,
  maxViolations: 50,
};
