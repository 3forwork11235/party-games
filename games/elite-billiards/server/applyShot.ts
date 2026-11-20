import { roundPos, type ShotResult } from '../shared/physics/index.js';
import { resolveShot, type Resolution } from '../shared/rules.js';
import type { EliteBilliardsState } from '../shared/state.js';
import { HEAD_SPOT } from '../shared/table.js';
import { findFreeCueSpot } from './shotInput.js';

export interface PendingShot {
  shooterId: string;
  result: ShotResult;
}

/** Применить итог удара к шарам состояния (позиции, забитые, возврат битка) и вернуть разбор. */
export function applyShotToBalls(s: EliteBilliardsState, p: PendingShot): Resolution {
  const { result } = p;
  const finals = new Map(result.final.map((f) => [f.id, f]));
  const values = new Map<number, number>();
  for (const b of s.balls) if (b.id > 0) values.set(b.id, b.value);
  const res = resolveShot({ result, values, cueInHand: s.cueInHand });
  const scratch = res.foul === 'scratch';
  for (const b of s.balls) {
    if (b.potted) continue;
    const f = finals.get(b.id);
    if (f) {
      b.x = roundPos(f.x);
      b.y = roundPos(f.y);
    } else if (result.potted.includes(b.id) && b.id > 0) {
      b.potted = true;
      b.pottedBy = scratch ? '' : p.shooterId;
    }
  }
  if (scratch) {
    const cue = s.balls.find((b) => b.id === 0);
    if (cue) {
      const spot = findFreeCueSpot(s.balls.toArray(), HEAD_SPOT);
      cue.x = roundPos(spot.x);
      cue.y = roundPos(spot.y);
      cue.potted = false;
    }
  }
  return res;
}
