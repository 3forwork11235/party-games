import { PartyRoom } from '@party/core/server';
import { maskProfanity, normalizeAnswer, sanitizeAnswer } from '@party/core/shared';
import { LIE_MAX, VOTE_MS, gameConfig, isLang, isRoundOption } from '../shared/config.js';
import { buildOptions, isTruth, pickHint, pickQuestion, scoreRound } from '../shared/logic.js';
import {
  MSG_HELLO,
  MSG_HINT,
  MSG_LIE,
  MSG_SETTINGS,
  MSG_VOTE,
  MSG_YOU,
  type GameClientMessages as Msg,
  type YouMessage,
} from '../shared/messages.js';
import { DEFAULT_PACKS, isPackId, parseQuestionId, type PackId } from '../shared/packs.js';
import { BluffOption, BluffState } from '../shared/state.js';
import { getQuestion, type BankQuestion } from './bank.js';
import { RoundSecret } from './secret.js';

const MAX_PACKS = 4;

/**
 * Блефопедия. Стадии round: write (roundMs) → vote (stageMs.vote) через restartRound
 * и onRoundTimeout; собственных clock-таймеров нет.
 */
export class BluffRoom extends PartyRoom<BluffState> {
  protected readonly gameConfig = gameConfig;
  /** Длительность стадии vote (стадия write — gameConfig.roundMs). */
  protected readonly stageMs = { vote: VOTE_MS };

  protected secret = new RoundSecret();
  private readonly usedQuestions = new Set<string>();

  protected createState(): BluffState {
    return new BluffState();
  }

  /** Запись вопроса (ответ, alt, fake) из серверного банка; тесты подменяют. */
  protected question(id: string): BankQuestion | null {
    return getQuestion(id, this.state.lang || 'ru');
  }

  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.state.packs.push(...DEFAULT_PACKS);
    this.onGameMessage<Msg[typeof MSG_SETTINGS]>(MSG_SETTINGS, ['lobby'], (id, m) =>
      this.handleSettings(id, m),
    );
    this.onGameMessage<Msg[typeof MSG_HELLO]>(MSG_HELLO, ['round', 'roundEnd'], (id) =>
      this.sendYou(id),
    );
    this.onGameMessage<Msg[typeof MSG_LIE]>(MSG_LIE, ['round'], (id, m) => this.handleLie(id, m));
    this.onGameMessage<Msg[typeof MSG_VOTE]>(MSG_VOTE, ['round'], (id, m) =>
      this.handleVote(id, m),
    );
    this.onGameMessage<Msg[typeof MSG_HINT]>(MSG_HINT, ['round'], (id) => this.handleHint(id));
  }

  onGameStart(): void {
    this.state.totalRounds = this.state.rounds;
    this.usedQuestions.clear();
    this.clearRound();
  }

  onRoundStart(): void {
    this.clearRound();
    const packs = this.state.packs.toArray().filter(isPackId);
    const pool: PackId[] = packs.length > 0 ? packs : [...DEFAULT_PACKS];
    let id = '';
    let record: BankQuestion | null = null;
    for (let i = 0; i < 20 && record === null; i++) {
      id = pickQuestion(pool, this.usedQuestions, Math.random);
      this.usedQuestions.add(id);
      record = this.question(id);
    }
    const s = this.state;
    this.secret.record = record;
    s.questionId = id;
    s.category = parseQuestionId(id)?.pack ?? '';
    s.question = record?.q ?? '___';
    s.stage = 'write';
  }

  onRoundTimeout(): boolean {
    if (this.state.stage !== 'write') return false;
    this.startVote();
    return true;
  }

  /** Публикует правду, авторов и голоса; возвращает очки. */
  onRoundEnd(): Record<string, number> {
    const sec = this.secret;
    const s = this.state;
    if (sec.options.length === 0) this.makeOptions();
    for (const o of sec.options) {
      if (o.kind === 'truth') s.truthId = o.id;
      for (const a of o.authors) s.lies.set(a, o.id);
    }
    for (const [voter, optionId] of sec.votes) s.votes.set(voter, optionId);
    s.stage = '';
    const players = this.getPlayers().map((p) => p.id);
    return scoreRound(sec.options, sec.votes, players);
  }

  onPlayerJoin(playerId: string): void {
    if (this.state.phase === 'round' || this.state.phase === 'roundEnd') this.sendYou(playerId);
  }

  onPlayerLeave(): void {
    this.recheck();
  }

  // ---- стадии ----

  private connectedIds(): Set<string> {
    return new Set(
      this.getPlayers()
        .filter((p) => p.connected)
        .map((p) => p.id),
    );
  }

  private makeOptions(): void {
    const sec = this.secret;
    sec.options = buildOptions(
      {
        truth: sec.record?.a ?? '',
        alt: sec.record?.alt ?? [],
        fakes: sec.record?.fake ?? [],
        lies: sec.lies,
      },
      Math.random,
    );
    this.state.options.clear();
    for (const o of sec.options) {
      const opt = new BluffOption();
      opt.id = o.id;
      opt.text = o.text;
      this.state.options.push(opt);
    }
  }

  private startVote(): void {
    const s = this.state;
    if (s.stage !== 'write') return;
    this.makeOptions();
    s.voted.clear();
    s.stage = 'vote';
    this.restartRound(this.stageMs.vote);
    for (const p of this.getPlayers()) this.sendYou(p.id);
  }

  /** Досрочные переходы после изменения числа подключённых, выдумок или голосов. */
  private recheck(): void {
    const s = this.state;
    const connected = this.connectedIds();
    if (s.phase !== 'round' || connected.size < 2) return;
    if (s.stage === 'write') {
      if ([...connected].every((id) => s.submitted.includes(id))) this.startVote();
    } else if (s.stage === 'vote') {
      if ([...connected].every((id) => s.voted.includes(id))) this.endRound();
    }
  }

  private clearRound(): void {
    this.secret = new RoundSecret();
    const s = this.state;
    s.stage = '';
    s.questionId = s.category = s.question = '';
    s.submitted.clear();
    s.voted.clear();
    s.options.clear();
    s.truthId = '';
    s.lies.clear();
    s.votes.clear();
  }

  /** `bluffopedia:you` адресно: моя выдумка, мой вариант, убранный подсказкой. */
  protected sendYou(playerId: string): void {
    if (!this.state.players.has(playerId)) return;
    const sec = this.secret;
    const own = sec.options.find((o) => o.authors.includes(playerId));
    const msg: YouMessage = {
      round: this.state.round,
      lie: sec.lies.get(playerId) ?? '',
      ownId: own?.id ?? '',
      hintId: sec.hints.get(playerId) ?? '',
    };
    this.sendToPlayer(playerId, MSG_YOU, msg);
  }

  private toastTo(playerId: string, key: string): void {
    this.sendToPlayer(playerId, 'core:toast', { key });
  }

  // ---- обработчики ----

  private handleSettings(playerId: string, msg: Msg[typeof MSG_SETTINGS]): void {
    if (playerId !== this.state.hostId || !Array.isArray(msg?.packIds)) return;
    const ids = [...new Set(msg.packIds)];
    if (ids.length < 1 || ids.length > MAX_PACKS || !ids.every(isPackId)) return;
    if (!isRoundOption(msg.rounds) || !isLang(msg.lang)) return;
    this.state.packs.clear();
    this.state.packs.push(...ids);
    this.state.rounds = msg.rounds;
    this.state.lang = msg.lang;
  }

  private handleLie(playerId: string, msg: Msg[typeof MSG_LIE]): void {
    const sec = this.secret;
    if (this.state.stage !== 'write') return;
    const clean = sanitizeAnswer(msg?.text, LIE_MAX);
    const text = clean === null ? '' : maskProfanity(clean);
    if (text === '' || normalizeAnswer(text) === '') return this.toastTo(playerId, 'bluff.toast.empty');
    if (sec.record && isTruth(text, sec.record.a, sec.record.alt)) {
      return this.toastTo(playerId, 'bluff.toast.truth');
    }
    sec.lies.set(playerId, text);
    if (!this.state.submitted.includes(playerId)) this.state.submitted.push(playerId);
    this.sendYou(playerId);
    this.recheck();
  }

  private handleVote(playerId: string, msg: Msg[typeof MSG_VOTE]): void {
    const sec = this.secret;
    const optionId = msg?.optionId;
    if (this.state.stage !== 'vote' || typeof optionId !== 'string') return;
    const opt = sec.options.find((o) => o.id === optionId);
    if (!opt || opt.authors.includes(playerId) || sec.hints.get(playerId) === optionId) return;
    sec.votes.set(playerId, optionId);
    if (!this.state.voted.includes(playerId)) this.state.voted.push(playerId);
    this.recheck();
  }

  private handleHint(playerId: string): void {
    const sec = this.secret;
    if (this.state.stage !== 'vote' || sec.hintUsed.has(playerId)) return;
    const hintId = pickHint(sec.options, playerId, Math.random);
    if (hintId === '') return this.toastTo(playerId, 'bluff.toast.nohint');
    sec.hintUsed.add(playerId);
    sec.hints.set(playerId, hintId);
    if (sec.votes.get(playerId) === hintId) {
      sec.votes.delete(playerId);
      const at = this.state.voted.indexOf(playerId);
      if (at >= 0) this.state.voted.splice(at, 1);
    }
    this.sendYou(playerId);
  }
}
