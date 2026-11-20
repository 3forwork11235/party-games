import { BALL_SPECS } from '../shared/table.js';
import type { EliteBilliardsPublicState } from '../shared/types.js';
import type { Replay } from './replay.js';
import type { BallMeta, DrawBall } from './types.js';

export const CUE_META: BallMeta = { id: 0, kind: 'cue', value: 0, r: BALL_SPECS.cue.r };

/** Шары для отрисовки: из проигрывания или из состояния; биток «с руки» — в позиции hand. */
export function displayBalls(
  last: EliteBilliardsPublicState | null,
  replay: Replay,
  meta: ReadonlyMap<number, BallMeta>,
  hand: { x: number; y: number },
): DrawBall[] {
  const out: DrawBall[] = [];
  const src: ReadonlyArray<{ id: number; x: number; y: number }> = replay.active
    ? replay.balls.filter((b) => !b.potted)
    : (last?.balls ?? []).filter((b) => !b.potted);
  for (const b of src) {
    const m = meta.get(b.id) ?? (b.id === 0 ? CUE_META : undefined);
    if (m) out.push({ id: b.id, kind: m.kind, value: m.value, r: m.r, x: b.x, y: b.y });
  }
  if (!replay.active && last?.cueInHand && last.phase === 'round') {
    const cue: DrawBall = { id: 0, kind: 'cue', value: 0, r: CUE_META.r, x: hand.x, y: hand.y };
    const i = out.findIndex((b) => b.id === 0);
    if (i >= 0) out[i] = cue;
    else out.push(cue);
  }
  return out;
}
