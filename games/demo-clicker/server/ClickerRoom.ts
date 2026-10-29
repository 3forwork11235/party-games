import { PartyRoom } from '@party/core/server';
import { MAX_TAPS_PER_WINDOW, TAP_WINDOW_MS, gameConfig } from '../shared/config.js';
import { MSG_TAP } from '../shared/messages.js';
import { createTapLimiter, scoreRound } from '../shared/scoring.js';
import { ClickerState } from '../shared/state.js';

type TapLimiter = ReturnType<typeof createTapLimiter>;

export class ClickerRoom extends PartyRoom<ClickerState> {
  protected readonly gameConfig = gameConfig;
  /** Окно лимита нажатий; переопределяется в тестах. */
  protected readonly tapWindowMs: number = TAP_WINDOW_MS;
  private readonly tapLimiters = new Map<string, TapLimiter>();

  protected createState(): ClickerState {
    return new ClickerState();
  }

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.onGameMessage(MSG_TAP, ['round'], (playerId) => this.handleTap(playerId));
  }

  onGameStart(): void {
    this.resetRound();
  }

  onRoundStart(): void {
    this.resetRound();
  }

  onRoundEnd(): Record<string, number> {
    return scoreRound(this.state.finishOrder.toArray());
  }

  onPlayerLeave(): void {
    if (this.state.phase === 'round') this.checkAllFinished();
  }

  private resetRound(): void {
    this.tapLimiters.clear();
    this.state.finishOrder.clear();
    this.state.clicks.clear();
    for (const p of this.getPlayers()) this.state.clicks.set(p.id, 0);
  }

  private handleTap(playerId: string): void {
    const { state } = this;
    const count = state.clicks.get(playerId);
    if (count === undefined || count >= state.target) return;
    let limiter = this.tapLimiters.get(playerId);
    if (!limiter) {
      limiter = createTapLimiter(MAX_TAPS_PER_WINDOW, this.tapWindowMs);
      this.tapLimiters.set(playerId, limiter);
    }
    if (!limiter.allow(this.now())) return;
    state.clicks.set(playerId, count + 1);
    if (count + 1 >= state.target) {
      state.finishOrder.push(playerId);
      this.checkAllFinished();
    }
  }

  /** Досрочный конец раунда: все подключённые дошли до target. */
  private checkAllFinished(): void {
    const connected = this.getPlayers().filter((p) => p.connected);
    if (connected.length === 0) return;
    const done = new Set(this.state.finishOrder);
    if (connected.every((p) => done.has(p.id))) this.endRound();
  }
}
