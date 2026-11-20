import { PartyRoom } from '@party/core/server';
import {
  AIM_MAX_PER_SEC,
  BOT_AIM_LEAD_MS,
  BOT_THINK_MS,
  RACK_MAX_MS,
  ROLL_GRACE_MS,
  gameConfig,
} from '../shared/config.js';
import {
  MSG_ADD_GUEST,
  MSG_AIM,
  MSG_AIM_OF,
  MSG_SHOT,
  MSG_SHOT_PLAYED,
  type AimOfMessage,
  type ShotPlayedMessage,
} from '../shared/messages.js';
import { roundPos, simulateShot } from '../shared/physics/index.js';
import { createRack, isValidCuePlacement, type RackBall } from '../shared/rack.js';
import {
  clampRackScore,
  firstShooter,
  nextShooter,
  resolveTimeout,
  type Resolution,
} from '../shared/rules.js';
import { BallState, EliteBilliardsState } from '../shared/state.js';
import { scheduleBotTurn, type BotTimer } from './botTurn.js';
import { addGuest, canControl, isPresent, sweepGuests, type GuestHost } from './guests.js';
import { parseAim, parseShot } from './shotInput.js';
import { applyShotToBalls, type PendingShot } from './applyShot.js';

/**
 * Элитный бильярд. Стадии round: aim (SHOT_MS) → rolling (durationMs + ROLL_GRACE_MS) через
 * restartRound/onRoundTimeout. Итог удара попадает в state только после rolling.
 */
export class EliteBilliardsRoom extends PartyRoom<EliteBilliardsState> {
  protected readonly gameConfig = gameConfig;

  private pending: PendingShot | null = null;
  private aimTimes: number[] = [];
  private botTimer: BotTimer | null = null;
  protected botThinkMs: readonly [number, number] = BOT_THINK_MS;
  protected botAimLeadMs = BOT_AIM_LEAD_MS;

  protected createState(): EliteBilliardsState {
    return new EliteBilliardsState();
  }

  /** Источник случайности для раскладки (тесты переопределяют). */
  protected rng(): number {
    return Math.random();
  }

  /** Раскладка раунда (тесты подменяют). */
  protected createRackBalls(): RackBall[] {
    return createRack(() => this.rng());
  }

  /** Сколько ждать после удара, прежде чем применить итог. */
  protected rollMs(durationMs: number): number {
    return durationMs + ROLL_GRACE_MS;
  }

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.onGameMessage<unknown>(MSG_SHOT, ['round'], (id, m) => this.handleShot(id, m));
    this.onGameMessage<unknown>(MSG_AIM, ['round'], (id, m) => this.handleAim(id, m));
    this.onGameMessage<unknown>(MSG_ADD_GUEST, ['lobby'], (id, m) =>
      addGuest(this.guestHost(), id, m),
    );
  }

  /** Гости (hot-seat) убираются из лобби вместе с владельцем или по кику хоста. */
  protected onRosterChanged(): void {
    super.onRosterChanged();
    sweepGuests(this.guestHost());
  }

  private guestHost(): GuestHost {
    return {
      state: this.state,
      addBot: (setup) => this.addBot(setup),
      kick: (id) => this.kickByHost(id),
      isBot: (id) => this.isBot(id),
    };
  }

  onGameStart(): void {
    const s = this.state;
    sweepGuests(this.guestHost());
    s.order.clear();
    for (const p of this.getPlayers()) if (p.connected) s.order.push(p.id);
    s.rackScore.clear();
    for (const id of s.order) s.rackScore.set(id, 0);
  }

  onRoundStart(round: number): void {
    const s = this.state;
    this.pending = null;
    this.aimTimes = [];
    s.balls.clear();
    for (const b of this.createRackBalls()) {
      const ball = new BallState();
      ball.id = b.id;
      ball.kind = b.kind;
      ball.x = roundPos(b.x);
      ball.y = roundPos(b.y);
      ball.r = b.r;
      ball.value = b.value;
      s.balls.push(ball);
    }
    s.rackScore.clear();
    for (const p of this.getPlayers()) s.rackScore.set(p.id, 0);
    s.shooterId = firstShooter(s.order.toArray(), round, (id) => this.isConnected(id));
    s.shotNo = 0;
    s.cueInHand = false;
    s.lastShooterId = '';
    s.lastPoints = 0;
    s.lastFoul = '';
    s.rackEndsAt = this.now() + RACK_MAX_MS;
    s.stage = 'aim';
    this.scheduleBot();
  }

  onRoundTimeout(): boolean {
    const s = this.state;
    if (s.stage === 'rolling' && this.pending) {
      const p = this.pending;
      this.pending = null;
      this.applyShot(p);
    } else if (s.stage === 'aim') {
      this.applyResolution(s.shooterId, resolveTimeout(s.cueInHand));
      this.advance(false, s.cueInHand);
    }
    return true;
  }

  onRoundEnd(): Record<string, number> {
    this.stopTurns();
    const out: Record<string, number> = {};
    for (const p of this.getPlayers())
      out[p.id] = clampRackScore(this.state.rackScore.get(p.id) ?? 0);
    return out;
  }

  onGameEnd(): void {
    this.stopTurns();
  }

  onPlayerLeave(playerId: string): void {
    const s = this.state;
    if (s.phase !== 'round' || s.stage !== 'aim' || !canControl(s.guests, playerId, s.shooterId))
      return;
    const from = s.shooterId;
    const next = nextShooter(s.order.toArray(), from, (id) => this.isConnected(id));
    if (next === '' || next === from) return;
    s.shooterId = next;
    this.restartRound(this.config.roundMs);
    this.scheduleBot();
  }

  // ---- ход ----

  private isConnected(id: string): boolean {
    return isPresent(this.state, id);
  }

  private stopTurns(): void {
    this.botTimer?.clear();
    this.botTimer = null;
    this.state.stage = '';
    this.pending = null;
  }

  /** Стрелок — бот в стадии aim: спланировать и отыграть удар. */
  private scheduleBot(): void {
    this.botTimer?.clear();
    const s = this.state;
    if (
      s.phase !== 'round' ||
      s.stage !== 'aim' ||
      !this.isBot(s.shooterId) ||
      s.guests.has(s.shooterId)
    )
      return;
    const id = s.shooterId;
    this.botTimer = scheduleBotTurn({
      clock: this.clock,
      rng: () => this.rng(),
      state: s,
      think: this.botThinkMs,
      lead: this.botAimLeadMs,
      onAim: (m) => this.broadcast(MSG_AIM_OF, { ...m, shooterId: id }),
      onShot: (m) => this.handleShot(id, m),
    });
  }

  private handleShot(playerId: string, raw: unknown): void {
    const s = this.state;
    if (s.stage !== 'aim' || !canControl(s.guests, playerId, s.shooterId)) return;
    const shooterId = s.shooterId;
    const shot = parseShot(raw);
    if (!shot) return;
    const live = s.balls.filter((b) => !b.potted);
    const cue = live.find((b) => b.id === 0);
    if (!cue) return;
    let cx = cue.x;
    let cy = cue.y;
    if (s.cueInHand) {
      if (shot.cueX === undefined || shot.cueY === undefined) return;
      cx = roundPos(shot.cueX);
      cy = roundPos(shot.cueY);
      if (!isValidCuePlacement(cx, cy, live)) return;
    }
    const balls = live.map((b) => ({
      id: b.id,
      x: b.id === 0 ? cx : b.x,
      y: b.id === 0 ? cy : b.y,
      r: b.r,
    }));
    const result = simulateShot({
      balls,
      dx: shot.dx,
      dy: shot.dy,
      power: shot.power,
      spinX: shot.spinX,
      spinY: shot.spinY,
    });
    s.shotNo += 1;
    this.botTimer?.clear();
    this.pending = { shooterId, result };
    s.stage = 'rolling';
    const msg: ShotPlayedMessage = {
      shotNo: s.shotNo,
      shooterId,
      balls: balls.map((b) => ({ id: b.id, x: b.x, y: b.y })),
      dx: shot.dx,
      dy: shot.dy,
      power: shot.power,
      spinX: shot.spinX,
      spinY: shot.spinY,
      durationMs: result.durationMs,
    };
    this.broadcast(MSG_SHOT_PLAYED, msg);
    this.restartRound(this.rollMs(result.durationMs));
  }

  private handleAim(playerId: string, raw: unknown): void {
    const s = this.state;
    if (s.stage !== 'aim' || !canControl(s.guests, playerId, s.shooterId)) return;
    const aim = parseAim(raw);
    if (!aim) return;
    const t = this.now();
    this.aimTimes = this.aimTimes.filter((x) => t - x < 1000);
    if (this.aimTimes.length >= AIM_MAX_PER_SEC) return;
    this.aimTimes.push(t);
    const msg: AimOfMessage = { ...aim, shooterId: s.shooterId };
    const client = this.clientOf(playerId);
    this.broadcast(MSG_AIM_OF, msg, client ? { except: client } : undefined);
  }

  /** Применить итог удара после rolling. */
  private applyShot(p: PendingShot): void {
    const res = applyShotToBalls(this.state, p);
    this.applyResolution(p.shooterId, res);
    this.advance(res.keepTurn, res.cueInHandNext);
  }

  private applyResolution(shooterId: string, res: Resolution): void {
    const s = this.state;
    s.rackScore.set(shooterId, (s.rackScore.get(shooterId) ?? 0) + res.points);
    s.lastShooterId = shooterId;
    s.lastPoints = res.points;
    s.lastFoul = res.foul;
  }

  /** Следующий ход или конец раскладки. */
  private advance(keepTurn: boolean, cueInHand: boolean): void {
    const s = this.state;
    s.cueInHand = cueInHand;
    const left = s.balls.some((b) => b.id > 0 && !b.potted);
    if (!left || this.now() >= s.rackEndsAt) {
      this.endRound();
      return;
    }
    const prev = s.shooterId;
    s.shooterId =
      keepTurn && this.isConnected(prev)
        ? prev
        : nextShooter(s.order.toArray(), prev, (id) => this.isConnected(id));
    s.stage = 'aim';
    this.restartRound(this.config.roundMs);
    this.scheduleBot();
  }
}
