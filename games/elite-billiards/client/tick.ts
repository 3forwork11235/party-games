import { DT } from '../shared/physics/index.js';
import { BALL_SPECS, POCKETS } from '../shared/table.js';
import type { Orientation } from './render/balls.js';
import type { Replay, TickResult } from './replay.js';
import type { PotAnim } from './scene.js';
import type { Sound } from './sound.js';
import type { BallMeta } from './types.js';

export interface TickDeps {
  now: number;
  meta: ReadonlyMap<number, BallMeta>;
  pots: PotAnim[];
  orient: Orientation;
  sound: Sound;
}

/** События шага проигрывания → звук, анимация падения в лузу, вращение шаров. */
export function applyTick(replay: Replay, r: TickResult, d: TickDeps): void {
  if (r.steps === 0) return;
  // Догоняем (скрытая вкладка) — без звуков и анимаций.
  const quiet = r.steps > 200;
  for (const e of r.events) {
    if (quiet) break;
    if (e.type === 'pot') {
      const b = replay.balls.find((q) => q.id === e.ball);
      const m =
        d.meta.get(e.ball) ??
        (e.ball === 0 ? { id: 0, kind: 'cue', value: 0, r: BALL_SPECS.cue.r } : undefined);
      const p = POCKETS[e.pocket];
      if (b && m && p) {
        d.pots.push({
          ball: { id: b.id, kind: m.kind, value: m.value, r: b.r, x: b.x, y: b.y },
          px: p.x,
          py: p.y,
          t0: d.now,
        });
      }
      d.sound.pot();
    } else if (e.type === 'ball') d.sound.click(e.impulse);
    else d.sound.thump(e.impulse);
  }
  for (const b of replay.balls) {
    if (!b.potted) d.orient.spin(b.id, b.wx, b.wy, b.wz, r.steps * DT);
  }
}
