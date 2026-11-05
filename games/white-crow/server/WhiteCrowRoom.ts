import { PartyRoom } from '@party/core/server';
import { gameConfig } from '../shared/config.js';
import { MSG_TAP, type GameClientMessages } from '../shared/messages.js';
import { pointsForTaps } from '../shared/scoring.js';
import { WhiteCrowState } from '../shared/state.js';

export class WhiteCrowRoom extends PartyRoom<WhiteCrowState> {
  protected readonly gameConfig = gameConfig;
  private taps = new Map<string, number>();

  protected createState(): WhiteCrowState {
    return new WhiteCrowState();
  }

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.onGameMessage<GameClientMessages[typeof MSG_TAP]>(MSG_TAP, ['round'], (playerId) => {
      this.taps.set(playerId, (this.taps.get(playerId) ?? 0) + 1);
      this.state.taps++;
    });
  }

  onGameStart(): void {
    this.taps.clear();
    this.state.taps = 0;
  }

  onRoundStart(): void {
    this.taps.clear();
    this.state.taps = 0;
  }

  onRoundEnd(): Record<string, number> {
    const points: Record<string, number> = {};
    for (const [id, n] of this.taps) points[id] = pointsForTaps(n);
    return points;
  }
}
