import { PartyRoom } from '@party/core/server';
import { planBotPicks, botDelay } from '../shared/bots.js';
import { BOT_DELAY_MS, FINAL_MULTIPLIER, ROUND_OPTIONS, gameConfig } from '../shared/config.js';
import { buildDeck, buildRules, pickShown } from '../shared/logic.js';
import {
  MSG_HELLO,
  MSG_PEEK,
  MSG_PICK,
  MSG_SETTINGS,
  MSG_YOU,
  type GameClientMessages,
  type YouMessage,
} from '../shared/messages.js';
import { DEFAULT_PACKS, PACKS, isPackId, type PackId } from '../shared/packs.js';
import { roundStats, scoreRound } from '../shared/scoring.js';
import { CrowState } from '../shared/state.js';
import type { Rule } from '../shared/config.js';

export class CrowRoom extends PartyRoom<CrowState> {
  protected readonly gameConfig = gameConfig;
  /** Выборы приватны до roundEnd. */
  private picks = new Map<string, number>();
  /** Снимки подглядывания текущего раунда. */
  private snapshots = new Map<string, number[]>();
  private deck: string[] = [];
  /** Диапазон задержки ботов (переопределяется в тестах). */
  protected botDelayRange: readonly [number, number] = BOT_DELAY_MS;
  private botTimers: { clear(): void }[] = [];
  private readonly usedInRoom = new Set<string>();

  protected createState(): CrowState {
    return new CrowState();
  }

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.state.packs.push(...DEFAULT_PACKS);
    this.onGameMessage<GameClientMessages[typeof MSG_SETTINGS]>(MSG_SETTINGS, ['lobby'], (id, m) =>
      this.handleSettings(id, m),
    );
    this.onGameMessage<GameClientMessages[typeof MSG_HELLO]>(
      MSG_HELLO,
      ['round', 'roundEnd'],
      (id) => this.sendYou(id),
    );
    this.onGameMessage<GameClientMessages[typeof MSG_PICK]>(MSG_PICK, ['round'], (id, m) =>
      this.handlePick(id, m),
    );
    this.onGameMessage<GameClientMessages[typeof MSG_PEEK]>(MSG_PEEK, ['round'], (id) =>
      this.handlePeek(id),
    );
  }

  onGameStart(): void {
    const total = this.state.rounds;
    this.state.totalRounds = total;
    const packs = this.state.packs.toArray().filter(isPackId);
    this.deck = buildDeck(packs.length > 0 ? packs : DEFAULT_PACKS, total, this.usedInRoom);
    for (const q of this.deck) this.usedInRoom.add(q);
    this.state.rules.clear();
    this.state.rules.push(...buildRules(total));
    this.state.peekers.clear();
    this.state.lone.clear();
    this.state.matches.clear();
    this.clearRound();
  }

  onRoundStart(round: number): void {
    this.clearRound();
    this.state.questionId = this.deck[round - 1] ?? '';
    this.state.options.push(...pickShown(this.connectedCount()));
    this.scheduleBots(round);
  }

  onGameEnd(): void {
    this.clearBotTimers();
  }

  private scheduleBots(round: number): void {
    const botIds = this.getPlayers()
      .filter((p) => p.connected && this.isBot(p.id))
      .map((p) => p.id);
    if (botIds.length === 0) return;
    const rule = (this.state.rules[round - 1] ?? 'flock') as Rule;
    const plan = planBotPicks(rule, this.state.options.toArray(), botIds, Math.random);
    for (const [id, option] of plan) {
      const ms = botDelay(Math.random, this.botDelayRange);
      this.botTimers.push(
        this.clock.setTimeout(() => {
          if (this.state.phase === 'round' && this.state.round === round) {
            this.handlePick(id, { option });
          }
        }, ms),
      );
    }
  }

  private clearBotTimers(): void {
    for (const t of this.botTimers) t.clear();
    this.botTimers = [];
  }

  onRoundEnd(round: number): Record<string, number> {
    this.clearBotTimers();
    const rule = (this.state.rules[round - 1] ?? 'flock') as Rule;
    const mult = round >= this.state.totalRounds ? FINAL_MULTIPLIER : 1;
    for (const [id, option] of this.picks) this.state.picks.set(id, option);
    const { lone, matches } = roundStats(this.picks);
    for (const id of lone) this.state.lone.set(id, (this.state.lone.get(id) ?? 0) + 1);
    for (const [id, n] of Object.entries(matches)) {
      this.state.matches.set(id, (this.state.matches.get(id) ?? 0) + n);
    }
    return scoreRound(rule, this.picks, mult);
  }

  onPlayerLeave(): void {
    if (this.state.phase === 'round') this.checkAllPicked();
  }

  private clearRound(): void {
    this.clearBotTimers();
    this.picks.clear();
    this.snapshots.clear();
    this.state.picked.clear();
    this.state.picks.clear();
    this.state.options.clear();
    this.state.questionId = '';
  }

  private handleSettings(playerId: string, msg: GameClientMessages[typeof MSG_SETTINGS]): void {
    if (playerId !== this.state.hostId || !msg || !Array.isArray(msg.packIds)) return;
    const rounds = msg.rounds;
    if (!(ROUND_OPTIONS as readonly number[]).includes(rounds)) return;
    const ids: unknown[] = msg.packIds;
    if (ids.length > PACKS.length || new Set(ids).size !== ids.length) return;
    if (!ids.every(isPackId)) return;
    const next: PackId[] = ids.length > 0 ? ids : [...DEFAULT_PACKS];
    this.state.packs.clear();
    this.state.packs.push(...next);
    this.state.rounds = rounds;
  }

  private handlePick(playerId: string, msg: GameClientMessages[typeof MSG_PICK]): void {
    const option = msg?.option;
    if (typeof option !== 'number' || !Number.isInteger(option)) return;
    if (!this.state.options.includes(option)) return;
    this.picks.set(playerId, option);
    if (!this.state.picked.includes(playerId)) this.state.picked.push(playerId);
    this.checkAllPicked();
  }

  private handlePeek(playerId: string): void {
    if (this.state.peekers.includes(playerId)) {
      this.sendToPlayer(playerId, 'core:toast', { key: 'crow.toast.peekUsed' });
      return;
    }
    this.state.peekers.push(playerId);
    const counts = new Map<number, number>();
    for (const o of this.picks.values()) counts.set(o, (counts.get(o) ?? 0) + 1);
    this.snapshots.set(
      playerId,
      this.state.options.toArray().map((o) => counts.get(o) ?? 0),
    );
    this.sendYou(playerId);
    const nick = this.state.players.get(playerId)?.nick ?? '';
    this.toast('crow.toast.peek', { name: nick }, this.clientOf(playerId));
  }

  private sendYou(playerId: string): void {
    const msg: YouMessage = {
      round: this.state.round,
      option: this.picks.get(playerId) ?? -1,
      peek: this.snapshots.get(playerId) ?? [],
    };
    this.sendToPlayer(playerId, MSG_YOU, msg);
  }

  /** Досрочный конец раунда: все подключённые выбрали. */
  private checkAllPicked(): void {
    const connected = this.getPlayers().filter((p) => p.connected);
    if (connected.length === 0) return;
    if (connected.every((p) => this.picks.has(p.id))) this.endRound();
  }
}
