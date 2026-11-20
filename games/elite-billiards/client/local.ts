import { HEAD_SPOT } from '../shared/table.js';
import type { EliteBilliardsPublicState } from '../shared/types.js';
import type { AimState } from './types.js';

/** Стрелок «мой»: я сам или мой гость (hot-seat). */
export function isLocalPlayer(
  s: Pick<EliteBilliardsPublicState, 'guests'>,
  me: string,
  id: string,
): boolean {
  return id !== '' && (id === me || s.guests.get(id) === me);
}

/** Стартовый прицел хода: биток (или дом при «с руки») и направление на ближайший шар; сила/винт — по умолчанию. */
export function resetAim(s: EliteBilliardsPublicState, aim: AimState, resetPower: boolean): void {
  if (resetPower) {
    aim.power = 0.5;
    aim.spinX = 0;
    aim.spinY = 0;
  }
  const cue = s.balls.find((b) => b.id === 0);
  if (s.cueInHand || !cue) {
    aim.cueX = HEAD_SPOT.x;
    aim.cueY = HEAD_SPOT.y;
  } else {
    aim.cueX = cue.x;
    aim.cueY = cue.y;
  }
  let best = Infinity;
  for (const b of s.balls) {
    if (b.id === 0 || b.potted) continue;
    const d = Math.hypot(b.x - aim.cueX, b.y - aim.cueY);
    if (d < best && d > 0.01) {
      best = d;
      aim.dx = (b.x - aim.cueX) / d;
      aim.dy = (b.y - aim.cueY) / d;
    }
  }
}
