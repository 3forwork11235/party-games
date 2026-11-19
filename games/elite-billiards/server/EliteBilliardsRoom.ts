import { PartyRoom } from '@party/core/server';
import {
  AIM_MAX_PER_SEC,
  RACK_MAX_MS,
  ROLL_GRACE_MS,
  gameConfig,
} from '../shared/config.js';
import {
  MSG_AIM,
  MSG_AIM_OF,
  MSG_SHOT,
  MSG_SHOT_PLAYED,
  type AimOfMessage,
  type ShotPlayedMessage,
} from '../shared/messages.js';
import { roundPos, simulateShot, type ShotResult } from '../shared/physics/index.js';
import { createRack, isValidCuePlacement, type RackBall } from '../shared/rack.js';
import {
  clampRackScore,
  firstShooter,
  nextShooter,
  resolveShot,
  resolveTimeout,
  type Resolution,
} from '../shared/rules.js';
import { BallState, EliteBilliardsState } from '../shared/state.js';
import { HEAD_SPOT } from '../shared/table.js';
import { findFreeCueSpot, parseAim, parseShot } from './shotInput.js';

interface PendingShot {
  shooterId: string;
  result: ShotResult;
}

/**
 * Элитный бильярд. Стадии round: aim (SHOT_MS) → rolling (durationMs + ROLL_GRACE_MS) через
 * restartRound/onRoundTimeout. Итог удара попадает в state только после rolling.
 */
export class EliteBilliardsRoom extends PartyRoom<EliteBilliardsState> {
  protected readonly gameConfig = gameConfig;

  private pending: PendingShot | null = null;
  private aimTimes: number[] = [];

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
  }

  onGameStart(): void {
    const s = this.state;
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
    this.state.stage = '';
    this.pending = null;
    const out: Record<string, number> = {};
    for (const p of this.getPlayers()) out[p.id] = clampRackScore(this.state.rackScore.get(p.id) ?? 0);
    return out;
  }

  onGameEnd(): void {
    this.state.stage = '';
    this.pending = null;
  }

  onPlayerLeave(playerId: string): void {
    const s = this.state;
    if (s.phase !== 'round' || s.stage !== 'aim' || s.shooterId !== playerId) return;
    const next = nextShooter(s.order.toArray(), playerId, (id) => this.isConnected(id));
    if (next === '' || next === playerId) return;
    s.shooterId = next;
    this.restartRound(this.config.roundMs);
  }

  // ---- ход ----

  private isConnected(id: string): boolean {
    return this.state.players.get(id)?.connected === true;
  }

  private handleShot(playerId: string, raw: unknown): void {
    const s = this.state;
    if (s.stage !== 'aim' || s.shooterId !== playerId) return;
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
    this.pending = { shooterId: playerId, result };
    s.stage = 'rolling';
    const msg: ShotPlayedMessage = {
      shotNo: s.shotNo,
      shooterId: playerId,
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
    if (s.stage !== 'aim' || s.shooterId !== playerId) return;
    const aim = parseAim(raw);
    if (!aim) return;
    const t = this.now();
    this.aimTimes = this.aimTimes.filter((x) => t - x < 1000);
    if (this.aimTimes.length >= AIM_MAX_PER_SEC) return;
    this.aimTimes.push(t);
    const msg: AimOfMessage = { ...aim, shooterId: playerId };
    const client = this.clientOf(playerId);
    this.broadcast(MSG_AIM_OF, msg, client ? { except: client } : undefined);
  }

  /** Применить итог удара после rolling. */
  private applyShot(p: PendingShot): void {
    const s = this.state;
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
  }
}
