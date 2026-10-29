// КОНТРАКТ. Меняет только архитектор.
// abstract class PartyRoom<S extends CoreState> extends Room<S> implements PartyRoomApi
// Игра наследует PartyRoom и реализует PartyRoomHooks.
import type { GameConfig, IPlayer } from '../shared/contracts.js';

export interface PartyRoomHooks {
  /** Хост нажал start: сбросить игровое состояние. Очки core уже обнулены. */
  onGameStart(): void;
  onRoundStart(round: number): void;
  /** Каждые 100 мс в фазе 'round'. */
  onRoundTick?(dtMs: number): void;
  /** Таймаут раунда или вызов endRound(). Вернуть очки за раунд: playerId → points. */
  onRoundEnd(round: number): Record<string, number>;
  onGameEnd?(): void;
  onPlayerJoin?(playerId: string): void;
  /** consented=false — обрыв связи (идёт окно переподключения). */
  onPlayerLeave?(playerId: string, consented: boolean): void;
}

export interface PartyRoomApi {
  readonly config: GameConfig;
  /** Досрочно завершить текущий раунд (только в фазе 'round'). */
  endRound(): void;
  /**
   * Зарегистрировать игровое сообщение. Проходит через rate-limit,
   * обновляет lastActivity, отбрасывается вне перечисленных фаз.
   */
  onGameMessage<T>(
    type: string,
    phases: readonly string[],
    handler: (playerId: string, payload: T) => void,
  ): void;
  /** Подключённые и отключённые (в окне реконнекта) игроки. */
  getPlayers(): IPlayer[];
  sendToPlayer(playerId: string, type: string, payload: unknown): void;
  /** Серверное время, мс. Использовать вместо Date.now() (подменяется в тестах). */
  now(): number;
}

/** Каждая игра экспортирует из games/<slug>/server/src/index.ts: */
export interface GameServerModule {
  slug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- класс комнаты Colyseus
  Room: new (...args: any[]) => unknown;
}
