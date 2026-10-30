import { HINT_CROSS, MAX_HINTS, MAX_SELECTED_PACKS, isRoundOption } from '../shared/config.js';
import { findAccused, nextAsker, pickHint } from '../shared/logic.js';
import {
  MSG_ANSWERED,
  MSG_ASK,
  MSG_CALL_VOTE,
  MSG_GUESS,
  MSG_HELLO,
  MSG_HINT,
  MSG_PASS,
  MSG_SEEN,
  MSG_SETTINGS,
  MSG_VOTE,
  type GameClientMessages as Msg,
} from '../shared/messages.js';
import { isPackId } from '../shared/packs.js';
import { SpyRoomBase } from './SpyRoomBase.js';
import { applyAnswered, applyAsk, applyLeave, applyPass } from './turns.js';

/**
 * Шпион. Стадии round (roles → discussion → voting → lastChance) идут через restartRound(ms)
 * и onRoundTimeout (E1); собственных clock-таймеров для стадий нет.
 */
export class SpyRoom extends SpyRoomBase {
  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.onGameMessage<Msg[typeof MSG_SETTINGS]>(MSG_SETTINGS, ['lobby'], (id, m) =>
      this.handleSettings(id, m),
    );
    this.onGameMessage<Msg[typeof MSG_HELLO]>(MSG_HELLO, ['round', 'roundEnd'], (id) =>
      this.sendRole(id),
    );
    this.onGameMessage<Msg[typeof MSG_SEEN]>(MSG_SEEN, ['round'], (id) => this.handleSeen(id));
    this.onGameMessage<Msg[typeof MSG_ASK]>(MSG_ASK, ['round'], (id, m) => {
      if (this.state.stage === 'discussion') applyAsk(this.state, id, m?.targetId, this.roster());
    });
    this.onGameMessage<Msg[typeof MSG_ANSWERED]>(MSG_ANSWERED, ['round'], (id) => {
      if (this.state.stage === 'discussion') applyAnswered(this.state, id);
    });
    this.onGameMessage<Msg[typeof MSG_PASS]>(MSG_PASS, ['round'], (id) => {
      if (this.state.stage === 'discussion') applyPass(this.state, id, this.roster());
    });
    this.onGameMessage<Msg[typeof MSG_CALL_VOTE]>(MSG_CALL_VOTE, ['round'], (id, m) =>
      this.handleCallVote(id, m),
    );
    this.onGameMessage<Msg[typeof MSG_VOTE]>(MSG_VOTE, ['round'], (id, m) =>
      this.handleVote(id, m),
    );
    this.onGameMessage<Msg[typeof MSG_GUESS]>(MSG_GUESS, ['round'], (id, m) =>
      this.handleGuess(id, m),
    );
    this.onGameMessage<Msg[typeof MSG_HINT]>(MSG_HINT, ['round'], (id) => this.handleHint(id));
  }

  onRoundTimeout(): boolean {
    switch (this.state.stage) {
      case 'roles':
        this.startDiscussion();
        return true;
      case 'discussion':
        this.startVoting();
        return true;
      case 'voting':
        return this.resolveVoting();
      default:
        // lastChance: шпион не успел назвать локацию
        this.setResult('spy_caught', this.secret.accused, '');
        return false;
    }
  }

  onPlayerLeave(playerId: string): void {
    if (this.state.phase !== 'round') return;
    applyLeave(this.state, playerId, this.roster());
    this.recheck();
  }

  // ---- стадии ----

  private startDiscussion(): void {
    const s = this.state;
    if (s.stage !== 'roles') return;
    const roster = this.roster();
    if (!roster.connected.has(s.askerId)) {
      s.askerId = nextAsker(roster.order, s.askerId, roster.connected);
    }
    this.enterStage('discussion', this.stageMs.discussion);
  }

  private startVoting(): void {
    if (this.state.stage !== 'discussion') return;
    this.state.voteCalls.clear();
    this.state.voted.clear();
    this.state.targetId = '';
    this.enterStage('voting', this.stageMs.voting);
  }

  /** Итог голосования. true — начался последний шанс шпиона, false — исход определён. */
  private resolveVoting(): boolean {
    const sec = this.secret;
    sec.accused = findAccused(sec.ballots);
    const spyConnected = this.state.players.get(sec.spy)?.connected === true;
    if (sec.accused !== '' && sec.accused === sec.spy && spyConnected) {
      this.enterStage('lastChance', this.stageMs.lastChance);
      return true;
    }
    this.setResult(sec.accused === sec.spy ? 'spy_caught' : 'spy_escaped', sec.accused, '');
    return false;
  }

  /** Досрочные переходы после изменения числа подключённых или голосов. */
  private recheck(): void {
    const s = this.state;
    const connected = this.connectedIds();
    if (s.phase !== 'round' || connected.size < 2) return;
    if (s.stage === 'roles') {
      if ([...connected].every((id) => s.seen.includes(id))) this.startDiscussion();
    } else if (s.stage === 'discussion') {
      const calls = s.voteCalls.toArray().filter((id) => connected.has(id)).length;
      if (calls * 2 > connected.size) this.startVoting();
    } else if (s.stage === 'voting') {
      if ([...connected].every((id) => this.secret.ballots.has(id)) && !this.resolveVoting()) {
        this.endRound();
      }
    }
  }

  // ---- обработчики ----

  private handleSettings(playerId: string, msg: Msg[typeof MSG_SETTINGS]): void {
    if (playerId !== this.state.hostId || !Array.isArray(msg?.packIds)) return;
    const ids = [...new Set(msg.packIds)];
    if (ids.length < 1 || ids.length > MAX_SELECTED_PACKS || !ids.every(isPackId)) return;
    if (!isRoundOption(msg.rounds)) return;
    this.state.packs.clear();
    this.state.packs.push(...ids);
    this.state.rounds = msg.rounds;
  }

  private handleSeen(playerId: string): void {
    if (this.state.stage !== 'roles' || this.state.seen.includes(playerId)) return;
    this.state.seen.push(playerId);
    this.recheck();
  }

  private handleCallVote(playerId: string, msg: Msg[typeof MSG_CALL_VOTE]): void {
    const calls = this.state.voteCalls;
    if (this.state.stage !== 'discussion' || typeof msg?.on !== 'boolean') return;
    const at = calls.indexOf(playerId);
    if (msg.on && at < 0) calls.push(playerId);
    else if (!msg.on && at >= 0) calls.splice(at, 1);
    this.recheck();
  }

  private handleVote(playerId: string, msg: Msg[typeof MSG_VOTE]): void {
    const target = msg?.targetId;
    if (this.state.stage !== 'voting' || typeof target !== 'string') return;
    if (target === playerId || !this.state.players.has(target)) return;
    this.secret.ballots.set(playerId, target);
    if (!this.state.voted.includes(playerId)) this.state.voted.push(playerId);
    this.recheck();
  }

  private handleGuess(playerId: string, msg: Msg[typeof MSG_GUESS]): void {
    const sec = this.secret;
    const guess = msg?.locationId;
    const stage = this.state.stage;
    if (playerId !== sec.spy || sec.guessUsed || typeof guess !== 'string') return;
    if (stage !== 'discussion' && stage !== 'lastChance') return;
    if (!this.state.board.includes(guess)) return;
    sec.guessUsed = true;
    const correct = guess === sec.locationId;
    // досрочная догадка (discussion) ⇔ обвинённого нет
    if (stage === 'discussion') this.setResult(correct ? 'spy_guessed' : 'spy_wrong', '', guess);
    else this.setResult(correct ? 'spy_guessed' : 'spy_caught', sec.accused, guess);
    this.endRound();
  }

  private handleHint(playerId: string): void {
    const sec = this.secret;
    const stage = this.state.stage;
    if (playerId !== sec.spy || sec.hintsUsed >= MAX_HINTS) return;
    if (stage !== 'discussion' && stage !== 'voting' && stage !== 'lastChance') return;
    sec.crossed = pickHint(this.state.board.toArray(), sec.locationId, sec.crossed, HINT_CROSS);
    sec.hintsUsed++;
    this.sendRole(playerId);
  }
}
