/** Клиент → сервер: удар. Только стрелок, стадия aim. */
export const MSG_SHOT = 'elite-billiards:shot';
/** Клиент → сервер: текущий прицел стрелка (≤ AIM_MAX_PER_SEC), для зрителей. */
export const MSG_AIM = 'elite-billiards:aim';
/** Сервер → клиенты: удар принят, проиграть симуляцию. */
export const MSG_SHOT_PLAYED = 'elite-billiards:shotPlayed';
/** Сервер → клиенты (кроме стрелка): прицел стрелка. */
export const MSG_AIM_OF = 'elite-billiards:aimOf';

/** Клиент → сервер (lobby): добавить игрока на этом устройстве (hot-seat). */
export const MSG_ADD_GUEST = 'elite-billiards:addGuest';

export interface AddGuestMessage {
  nick: string;
  avatar: string;
}

export interface ShotMessage {
  /** Направление удара (будет нормировано сервером). */
  dx: number;
  dy: number;
  /** Сила 0..1. */
  power: number;
  /** Точка удара по битку в долях радиуса: x — вправо (правый винт), y — вверх (накат). |s| ≤ 0.5. */
  spinX: number;
  spinY: number;
  /** Только при cueInHand: куда поставлен биток (в «доме»). */
  cueX?: number;
  cueY?: number;
}

export interface AimMessage {
  dx: number;
  dy: number;
  power: number;
  cueX?: number;
  cueY?: number;
}

export interface AimOfMessage extends AimMessage {
  shooterId: string;
}

/** Начальная позиция шара для детерминированного проигрывания удара на клиенте. */
export interface BallInit {
  id: number;
  x: number;
  y: number;
}

export interface ShotPlayedMessage {
  shotNo: number;
  shooterId: string;
  /** Все шары на столе (не забитые) перед ударом, биток уже на поставленной позиции. */
  balls: BallInit[];
  /** Нормированное сервером направление. */
  dx: number;
  dy: number;
  power: number;
  spinX: number;
  spinY: number;
  /** Длительность симуляции (шагов × DT), мс. */
  durationMs: number;
}

export interface GameClientMessages {
  [MSG_SHOT]: ShotMessage;
  [MSG_AIM]: AimMessage;
  [MSG_ADD_GUEST]: AddGuestMessage;
}
