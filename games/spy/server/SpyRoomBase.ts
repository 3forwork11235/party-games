import { PartyRoom } from '@party/core/server';
import {
  BOARD_SIZE,
  DISCUSSION_MS,
  LAST_CHANCE_MS,
  MAX_HINTS,
  VOTING_MS,
  gameConfig,
} from '../shared/config.js';
import { assignRoles, buildBoard, pickLocation, pickSpy } from '../shared/logic.js';
import { MSG_ROLE, type SpyRoleMessage } from '../shared/messages.js';
import { DEFAULT_PACKS, isPackId, type PackId } from '../shared/packs.js';
import { scoreRound, type Outcome } from '../shared/scoring.js';
import { SpyState } from '../shared/state.js';
import type { Stage } from '../shared/types.js';
import { RoundSecret } from './secret.js';
import type { Roster } from './turns.js';

/** Состояние партии и раздача раунда; стадии, очередь и сообщения — в SpyRoom. */
export abstract class SpyRoomBase extends PartyRoom<SpyState> {
  protected readonly gameConfig = gameConfig;
  /** Длительности стадий после `roles` (длительность `roles` — gameConfig.roundMs). */
  protected readonly stageMs = {
    discussion: DISCUSSION_MS,
    voting: VOTING_MS,
    lastChance: LAST_CHANCE_MS,
  };

  protected readonly spyCount = new Map<string, number>();
  protected readonly usedLocations = new Set<string>();
  protected lastSpy = '';
  protected secret = new RoundSecret();

  protected createState(): SpyState {
    return new SpyState();
  }

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.state.packs.push(...DEFAULT_PACKS);
  }

  onGameStart(): void {
    this.state.totalRounds = this.state.rounds;
    this.spyCount.clear();
    this.usedLocations.clear();
    this.lastSpy = '';
    this.clearRound();
  }

  /** Шпион (из подключённых), локация, поле, роли (всем, в т.ч. отключённым в окне реконнекта). */
  onRoundStart(): void {
    this.clearRound();
    const all = this.getPlayers().map((p) => p.id);
    const connected = [...this.connectedIds()];
    const sec = this.secret;
    const packs = this.selectedPacks();
    sec.spy = pickSpy(connected.length > 0 ? connected : all, this.spyCount, this.lastSpy);
    this.spyCount.set(sec.spy, (this.spyCount.get(sec.spy) ?? 0) + 1);
    this.lastSpy = sec.spy;
    sec.locationId = pickLocation(packs, this.usedLocations);
    this.usedLocations.add(sec.locationId);
    this.state.board.push(...buildBoard(packs, sec.locationId, BOARD_SIZE));
    for (const [id, idx] of assignRoles(all.filter((id) => id !== sec.spy))) sec.roles.set(id, idx);
    this.state.askerId = connected[Math.floor(Math.random() * connected.length)] ?? '';
    this.state.stage = 'roles';
    for (const id of connected) this.sendRole(id);
  }

  /** Публикует раскрытие и считает очки; `result` задают стадии. */
  onRoundEnd(): Record<string, number> {
    const sec = this.secret;
    const r = sec.result ?? { outcome: 'spy_escaped' as Outcome, accused: '', guess: '' };
    const s = this.state;
    s.spyId = sec.spy;
    s.locationId = sec.locationId;
    s.accusedId = r.accused;
    s.guessId = r.guess;
    s.outcome = r.outcome;
    for (const [voter, target] of sec.ballots) s.votes.set(voter, target);
    s.stage = '';
    return scoreRound({
      outcome: r.outcome,
      spyId: sec.spy,
      players: this.getPlayers().map((p) => p.id),
      votes: sec.ballots,
    });
  }

  onPlayerJoin(playerId: string): void {
    if (this.state.phase === 'round' || this.state.phase === 'roundEnd') this.sendRole(playerId);
  }

  protected connectedIds(): Set<string> {
    return new Set(
      this.getPlayers()
        .filter((p) => p.connected)
        .map((p) => p.id),
    );
  }

  protected roster(): Roster {
    return { order: this.getPlayers().map((p) => p.id), connected: this.connectedIds() };
  }

  protected selectedPacks(): PackId[] {
    const packs = this.state.packs.toArray().filter(isPackId);
    return packs.length > 0 ? packs : [...DEFAULT_PACKS];
  }

  protected clearRound(): void {
    this.secret = new RoundSecret();
    const s = this.state;
    s.stage = '';
    s.board.clear();
    s.askerId = s.targetId = s.lastAskerId = '';
    s.questions = 0;
    s.seen.clear();
    s.voteCalls.clear();
    s.voted.clear();
    s.spyId = s.locationId = s.accusedId = s.guessId = s.outcome = '';
    s.votes.clear();
  }

  /** `spy:role` адресно: шпиону — без локации, остальным — локация и индекс роли. */
  protected sendRole(playerId: string): void {
    const sec = this.secret;
    if (sec.spy === '' || !this.state.players.has(playerId)) return;
    const round = this.state.round;
    const msg: SpyRoleMessage =
      playerId === sec.spy
        ? { round, spy: true, crossed: [...sec.crossed], hintsLeft: MAX_HINTS - sec.hintsUsed }
        : {
            round,
            spy: false,
            locationId: sec.locationId,
            roleIndex: sec.roles.get(playerId) ?? 0,
            crossed: [],
            hintsLeft: 0,
          };
    this.sendToPlayer(playerId, MSG_ROLE, msg);
  }

  protected enterStage(stage: Stage, ms: number): void {
    this.state.stage = stage;
    this.restartRound(ms);
  }

  protected setResult(outcome: Outcome, accused: string, guess: string): void {
    this.secret.result = { outcome, accused, guess };
  }
}
