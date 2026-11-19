import type { GameContext } from '@party/ui/app-shell';
import type { EliteBilliardsPublicState, IBall } from '../shared/types.js';

export type BilliardsCtx = GameContext<EliteBilliardsPublicState>;

/** Прицел локального игрока (или стрелка, если смотрим чужой ход). */
export interface AimState {
  dx: number;
  dy: number;
  power: number;
  spinX: number;
  spinY: number;
  cueX: number;
  cueY: number;
}

/** Шар для отрисовки. */
export interface DrawBall {
  id: number;
  kind: string;
  value: number;
  x: number;
  y: number;
  r: number;
}

export type BallMeta = Pick<IBall, 'id' | 'kind' | 'value' | 'r'>;
