import type { Client } from 'colyseus';
import type { ClientMessages, CorePhase, ServerMessages } from '../shared/contracts.js';
import { createFsm, type Fsm } from '../shared/fsm.js';
import { sanitizeChat } from '../shared/sanitize.js';
import { PartyRoomCore } from './PartyRoomCore.js';
import type { PartyRoomApi, PartyRoomHooks } from './contracts.js';
import type { CoreState } from './schema.js';

const TICK_MS = 100;

const TRANSITIONS: Record<CorePhase, CorePhase[]> = {
  lobby: ['countdown'],
  countdown: ['round', 'results'],
  round: ['roundEnd', 'results'],
  roundEnd: ['adBreak', 'results'],
  adBreak: ['countdown', 'results'],
  results: ['lobby'],
};

type Timer = ReturnType<PartyRoomCore<CoreState>['clock']['setTimeout']>;

/**
 * Базовая комната: код, игроки, хост, фазы, лимиты. Игра наследует и реализует хуки,
 * задаёт `gameConfig` и `createState()`. Если переопределяет onCreate — вызывать `super.onCreate()`.
 */
export abstract class PartyRoom<S extends CoreState>
  extends PartyRoomCore<S>
  implements PartyRoomApi, PartyRoomHooks
{
  abstract onGameStart(): void;
  abstract onRoundStart(round: number): void;
  abstract onRoundEnd(round: number): Record<string, number>;
  onRoundTick?(dtMs: number): void;
  onGameEnd?(): void;

  private readonly fsm: Fsm<CorePhase> = createFsm<CorePhase>({
    initial: 'lobby',
    transitions: TRANSITIONS,
    onEnter: (to) => {
      this.state.phase = to;
    },
  });
  private phaseTimer: Timer | undefined;
  private tickTimer: Timer | undefined;
  private adMinTimer: Timer | undefined;
  private adMinPassed = false;
  private readonly adDone = new Set<string>();

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.onMessage('core:ready', (c, m: ClientMessages['core:ready']) => this.handleReady(c, m));
    this.onMessage('core:start', (c) => this.handleStart(c));
    this.onMessage('core:kick', (c, m: ClientMessages['core:kick']) => this.handleKick(c, m));
    this.onMessage('core:chat', (c, m: ClientMessages['core:chat']) => this.handleChat(c, m));
    this.onMessage('core:adDone', (c) => this.handleAdDone(c));
    this.onMessage('core:restart', (c) => this.handleRestart(c));
  }

  onGameMessage<T>(
    type: string,
    phases: readonly string[],
    handler: (playerId: string, payload: T) => void,
  ): void {
    this.onMessage(type, (client: Client, payload: T) => {
      const playerId = this.admit(client);
      if (playerId && phases.includes(this.state.phase)) handler(playerId, payload);
    });
  }

  endRound(): void {
    if (this.state.phase === 'round') this.finishRound();
  }

  // ---- core-сообщения ----

  private hostId(client: Client): string | null {
    const id = this.admit(client);
    return id !== null && id === this.state.hostId ? id : null;
  }

  private handleReady(client: Client, msg: ClientMessages['core:ready']): void {
    const id = this.admit(client);
    const p = id ? this.state.players.get(id) : undefined;
    if (p && this.state.phase === 'lobby') p.ready = msg?.ready === true;
  }

  private handleStart(client: Client): void {
    if (!this.hostId(client) || this.state.phase !== 'lobby') return;
    if (this.connectedCount() < this.config.minPlayers) return;
    for (const p of this.getPlayers()) {
      p.score = 0;
      p.roundScore = 0;
    }
    this.state.round = 1;
    this.state.totalRounds = this.config.rounds;
    this.onGameStart();
    this.enterPhase('countdown', this.config.countdownMs);
  }

  private handleKick(client: Client, msg: ClientMessages['core:kick']): void {
    const me = this.hostId(client);
    if (!me || typeof msg?.playerId !== 'string' || msg.playerId === me) return;
    if (this.state.players.has(msg.playerId)) this.kickByHost(msg.playerId);
  }

  private handleChat(client: Client, msg: ClientMessages['core:chat']): void {
    const id = this.admit(client, true);
    const p = id ? this.state.players.get(id) : undefined;
    const text = sanitizeChat(msg?.text);
    if (!p || text === null) return;
    const out: ServerMessages['core:chat'] = {
      playerId: p.id,
      nick: p.nick,
      text,
      ts: this.now(),
    };
    this.broadcast('core:chat', out);
  }

  private handleAdDone(client: Client): void {
    const id = this.admit(client);
    if (!id || this.state.phase !== 'adBreak') return;
    this.adDone.add(id);
    this.checkAdBreak();
  }

  private handleRestart(client: Client): void {
    if (!this.hostId(client) || this.state.phase !== 'results') return;
    for (const p of this.getPlayers()) {
      if (!p.connected) this.state.players.delete(p.id);
      else {
        p.ready = false;
        p.roundScore = 0;
      }
    }
    this.state.round = 0;
    this.enterPhase('lobby');
  }

  // ---- фазы ----

  protected onRosterChanged(): void {
    const phase = this.state.phase;
    if (phase === 'lobby' || phase === 'results') return;
    if (this.connectedCount() < 2) this.enterResults();
    else if (phase === 'adBreak') this.checkAdBreak();
  }

  private clearTimers(): void {
    this.phaseTimer?.clear();
    this.tickTimer?.clear();
    this.adMinTimer?.clear();
    this.phaseTimer = this.tickTimer = this.adMinTimer = undefined;
  }

  private enterPhase(to: CorePhase, ms = 0): void {
    this.clearTimers();
    this.fsm.go(to);
    this.state.phaseEndsAt = ms > 0 ? this.now() + ms : 0;
    if (ms > 0) this.phaseTimer = this.clock.setTimeout(() => this.onPhaseTimeout(to), ms);
  }

  private onPhaseTimeout(phase: CorePhase): void {
    if (phase !== this.state.phase) return;
    if (phase === 'countdown') this.startRound();
    else if (phase === 'round') this.finishRound();
    else if (phase === 'roundEnd') this.afterRoundEnd();
    else if (phase === 'adBreak') this.endAdBreak();
  }

  private startRound(): void {
    this.enterPhase('round', this.config.roundMs);
    this.onRoundStart(this.state.round);
    let last = this.now();
    this.tickTimer = this.clock.setInterval(() => {
      const t = this.now();
      const dt = t - last;
      last = t;
      this.onRoundTick?.(dt);
    }, TICK_MS);
  }

  private finishRound(): void {
    this.enterPhase('roundEnd', this.config.roundEndMs);
    const points = this.onRoundEnd(this.state.round);
    for (const p of this.getPlayers()) {
      const add = points[p.id] ?? 0;
      p.roundScore = add;
      p.score += add;
    }
  }

  private afterRoundEnd(): void {
    if (this.state.round >= this.state.totalRounds) {
      this.enterResults();
      return;
    }
    this.adDone.clear();
    this.adMinPassed = false;
    this.enterPhase('adBreak', this.config.adBreakMaxMs);
    this.adMinTimer = this.clock.setTimeout(() => {
      this.adMinPassed = true;
      this.checkAdBreak();
    }, this.config.adBreakMinMs);
  }

  private checkAdBreak(): void {
    if (this.state.phase !== 'adBreak' || !this.adMinPassed) return;
    const waiting = this.getPlayers().some((p) => p.connected && !this.adDone.has(p.id));
    if (!waiting) this.endAdBreak();
  }

  private endAdBreak(): void {
    this.state.round += 1;
    this.enterPhase('countdown', this.config.countdownMs);
  }

  private enterResults(): void {
    this.enterPhase('results');
    this.onGameEnd?.();
  }
}
