import { planBotShot, type BotBall } from '../shared/bot.js';
import type { AimMessage, ShotMessage } from '../shared/messages.js';

export interface BotTimer {
  clear(): void;
}

export interface BotClock {
  setTimeout(fn: () => void, ms: number): BotTimer;
}

/** Нужная боту часть состояния комнаты. */
export interface BotTurnState {
  phase: string;
  stage: string;
  shooterId: string;
  shotNo: number;
  cueInHand: boolean;
  balls: Iterable<BotBall & { potted: boolean }>;
}

export interface BotTurnParams {
  clock: BotClock;
  rng: () => number;
  state: BotTurnState;
  /** Диапазон «раздумья» до удара, мс. */
  think: readonly [number, number];
  /** За сколько мс до удара разослать прицел. */
  lead: number;
  onAim: (aim: AimMessage) => void;
  onShot: (shot: ShotMessage) => void;
}

/** Спланировать удар бота сейчас: прицел за `lead` мс до удара, затем удар. Возвращает handle для clear(). */
export function scheduleBotTurn(p: BotTurnParams): BotTimer {
  const st = p.state;
  const id = st.shooterId;
  const shotNo = st.shotNo;
  /** Ход всё ещё тот же (фаза, стадия, стрелок, номер удара). */
  const isCurrent = (): boolean =>
    st.phase === 'round' && st.stage === 'aim' && st.shooterId === id && st.shotNo === shotNo;
  const live: BotBall[] = [];
  for (const b of st.balls) {
    if (!b.potted) live.push({ id: b.id, x: b.x, y: b.y, r: b.r, value: b.value });
  }
  const shot = planBotShot(live, st.cueInHand, p.rng);
  const [lo, hi] = p.think;
  const think = lo + p.rng() * (hi - lo);
  const aim: AimMessage = { dx: shot.dx, dy: shot.dy, power: shot.power };
  if (shot.cueX !== undefined && shot.cueY !== undefined) {
    aim.cueX = shot.cueX;
    aim.cueY = shot.cueY;
  }
  // Удар — вложенным таймером после прицела: два таймера в одном тике Colyseus идут не по порядку.
  const timers: BotTimer[] = [];
  const handle: BotTimer = {
    clear() {
      for (const t of timers) t.clear();
    },
  };
  const aimAt = Math.max(0, think - p.lead);
  timers.push(
    p.clock.setTimeout(() => {
      if (!isCurrent()) return;
      p.onAim(aim);
      timers.push(
        p.clock.setTimeout(() => {
          if (isCurrent()) p.onShot(shot);
        }, think - aimAt),
      );
    }, aimAt),
  );
  return handle;
}
