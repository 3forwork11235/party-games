import type { PartyClient } from '@party/core/client';
import type { GameConfig, ICoreState } from '@party/core/shared';
import type { Messages } from '@party/i18n';
import type { PlatformAdapter } from '@party/platform';
import type { TFunction } from '../types.js';

/** Что получает игра при монтировании. */
export interface GameContext<S extends ICoreState = ICoreState> {
  client: PartyClient<S>;
  t: TFunction;
  platform: PlatformAdapter;
  /** playerId текущего игрока. */
  me: string;
}

/** Представление игры: shell вызывает update на каждый снимок состояния. */
export interface GameView<S extends ICoreState = ICoreState> {
  update(state: S): void;
  destroy(): void;
}

export type MountGame<S extends ICoreState = ICoreState> = (
  container: HTMLElement,
  ctx: GameContext<S>,
) => GameView<S>;

export interface StartPartyAppOptions<S extends ICoreState = ICoreState> {
  slug: string;
  gameConfig: GameConfig;
  /** Игровые словари (games/<slug>/content/*.json) по языкам. */
  messages: { ru?: Messages; kk?: Messages; en?: Messages };
  mountGame: MountGame<S>;
  /** Корневой элемент; по умолчанию #app (создаётся при отсутствии). */
  root?: HTMLElement;
}
