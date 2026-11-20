import type { ICoreState } from '@party/core/shared';

export type BallKind = 'cue' | 'small' | 'std' | 'big' | 'giant' | 'gold';
export type ShotStage = 'aim' | 'rolling' | '';
export type FoulKind = '' | 'scratch' | 'noHit' | 'timeout';

export interface IBall {
  id: number;
  kind: string;
  x: number;
  y: number;
  r: number;
  value: number;
  potted: boolean;
  pottedBy: string;
}

/** Публичный вид состояния для клиента (без серверного Schema-класса). */
export interface EliteBilliardsPublicState extends ICoreState {
  balls: IBall[];
  order: string[];
  shooterId: string;
  stage: string;
  shotNo: number;
  cueInHand: boolean;
  rackScore: Map<string, number>;
  lastShooterId: string;
  lastPoints: number;
  lastFoul: string;
  guests: Map<string, string>;
  rackEndsAt: number;
}
