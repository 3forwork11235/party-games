import { PartyRoom } from '@party/core/server';
import { MAX_SKIPS, gameConfig } from '../shared/config.js';
import { buildDeck, drawReplacement } from '../shared/deck.js';
import {
  MSG_PACKS,
  MSG_SKIP,
  MSG_VOTE,
  type GameClientMessages,
} from '../shared/messages.js';
import { DEFAULT_PACKS, PACKS, isPackId, type PackId } from '../shared/packs.js';
import { findLeaders, scoreRound, tallyVotes, type Vote } from '../shared/scoring.js';
import { WhoOfUsState } from '../shared/state.js';

export class WhoOfUsRoom extends PartyRoom<WhoOfUsState> {
  protected readonly gameConfig = gameConfig;
  /** Голоса приватны до roundEnd (анонимность). */
  private votes = new Map<string, Vote>();
  private deck: string[] = [];
  private readonly used = new Set<string>();
  private readonly skippedBy = new Set<string>();

  protected createState(): WhoOfUsState {
    return new WhoOfUsState();
  }

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.state.packs.push(...DEFAULT_PACKS);
    this.onGameMessage<GameClientMessages[typeof MSG_PACKS]>(MSG_PACKS, ['lobby'], (id, m) =>
      this.handlePacks(id, m),
    );
    this.onGameMessage<GameClientMessages[typeof MSG_VOTE]>(MSG_VOTE, ['round'], (id, m) =>
      this.handleVote(id, m),
    );
    this.onGameMessage<GameClientMessages[typeof MSG_SKIP]>(MSG_SKIP, ['round'], (id) =>
      this.handleSkip(id),
    );
  }

  onGameStart(): void {
    const packs = this.state.packs.toArray().filter(isPackId);
    this.deck = buildDeck(packs.length > 0 ? packs : DEFAULT_PACKS, this.config.rounds);
    this.used.clear();
    this.skippedBy.clear();
    this.state.skipsLeft = MAX_SKIPS;
    this.state.leaderCount.clear();
    this.clearRound();
  }

  onRoundStart(round: number): void {
    this.clearRound();
    const q = this.deck[round - 1] ?? '';
    this.state.questionId = q;
    this.used.add(q);
  }

  onRoundEnd(): Record<string, number> {
    // включая отключённых в окне реконнекта: голоса за них не пропадают
    const present = new Set(this.getPlayers().map((p) => p.id));
    const tally = tallyVotes(this.votes, present);
    const leaders = findLeaders(tally);
    const points = scoreRound(this.votes, leaders);
    for (const [id, n] of Object.entries(tally)) this.state.tally.set(id, n);
    this.state.leaders.push(...leaders);
    this.state.correct.push(...Object.keys(points));
    for (const id of leaders) {
      this.state.leaderCount.set(id, (this.state.leaderCount.get(id) ?? 0) + 1);
    }
    return points;
  }

  onPlayerLeave(): void {
    if (this.state.phase === 'round') this.checkAllVoted();
  }

  private clearRound(): void {
    this.votes.clear();
    this.state.voted.clear();
    this.state.tally.clear();
    this.state.leaders.clear();
    this.state.correct.clear();
  }

  private handlePacks(playerId: string, msg: GameClientMessages[typeof MSG_PACKS]): void {
    if (playerId !== this.state.hostId || !Array.isArray(msg?.packIds)) return;
    const ids = [...new Set(msg.packIds)];
    if (ids.length > PACKS.length || !ids.every(isPackId)) return;
    const next: PackId[] = ids.length > 0 ? ids : [...DEFAULT_PACKS];
    this.state.packs.clear();
    this.state.packs.push(...next);
  }

  private handleVote(playerId: string, msg: GameClientMessages[typeof MSG_VOTE]): void {
    const { target, guess } = msg ?? {};
    if (typeof target !== 'string' || typeof guess !== 'string') return;
    const ids = new Set(this.getPlayers().map((p) => p.id));
    if (!ids.has(target) || !ids.has(guess)) return;
    this.votes.set(playerId, { target, guess });
    if (!this.state.voted.includes(playerId)) this.state.voted.push(playerId);
    this.checkAllVoted();
  }

  private handleSkip(playerId: string): void {
    if (this.state.skipsLeft <= 0 || this.skippedBy.has(playerId)) return;
    const packs = this.state.packs.toArray().filter(isPackId);
    const next = drawReplacement(this.deck, this.used, packs.length > 0 ? packs : DEFAULT_PACKS);
    if (next === null) return;
    this.skippedBy.add(playerId);
    this.state.skipsLeft--;
    this.deck[this.state.round - 1] = next;
    this.used.add(next);
    this.state.questionId = next;
    this.votes.clear();
    this.state.voted.clear();
    this.restartRound();
  }

  /** Досрочный конец раунда: все подключённые проголосовали. */
  private checkAllVoted(): void {
    const connected = this.getPlayers().filter((p) => p.connected);
    if (connected.length === 0) return;
    if (connected.every((p) => this.votes.has(p.id))) this.endRound();
  }
}
