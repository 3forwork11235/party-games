import type { Room } from 'colyseus.js';
import { CoreState, PartyRoom } from '../src/server/index.js';
import type { GameConfig, JoinOptions } from '../src/shared/contracts.js';

export class TestRoom extends PartyRoom<CoreState> {
  protected readonly gameConfig: GameConfig = {
    slug: 'test',
    minPlayers: 2,
    maxPlayers: 3,
    rounds: 2,
    countdownMs: 80,
    roundMs: 300,
    roundEndMs: 80,
    adBreakMinMs: 40,
    adBreakMaxMs: 400,
    reconnectSec: 3,
    idleKickSec: 180,
  };
  protected createState(): CoreState {
    return new CoreState();
  }
  onGameStart(): void {}
  onRoundStart(): void {}
  onRoundEnd(): Record<string, number> {
    const pts: Record<string, number> = {};
    for (const p of this.getPlayers()) if (p.connected) pts[p.id] = 10;
    return pts;
  }
}

export const opts = (id: string, nick = id): JoinOptions => ({
  playerId: id,
  nick,
  avatar: '\u{1F436}',
  lang: 'ru',
});

export async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  const ok = (): boolean => {
    try {
      return pred();
    } catch {
      return false;
    }
  };
  while (!ok()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Минимальный вид клиентского состояния для проверок. */
export interface TestState {
  code: string;
  phase: string;
  round: number;
  hostId: string;
  players: Map<string, { id: string; score: number; connected: boolean; nick: string }>;
}
export const st = (r: Room<unknown>): TestState => r.state as TestState;
