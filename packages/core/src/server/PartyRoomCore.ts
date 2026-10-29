import { Room, ServerError, type Client } from 'colyseus';
import {
  DEFAULT_RATE_LIMIT,
  type GameConfig,
  type IPlayer,
  type JoinOptions,
  type RateLimitConfig,
  type ServerMessages,
} from '../shared/contracts.js';
import { AVATARS, FRAMES, NICK_COLORS, PREMIUM_AVATARS } from '../shared/avatars.js';
import { generateRoomCode } from '../shared/roomCode.js';
import { sanitizeNick } from '../shared/sanitize.js';
import { ClientLimiter } from './clientLimiter.js';
import { CoreState, Player } from './schema.js';

export const CODES_KEY = 'party:codes';
const CLOSE_CONSENTED = 4000;
const CLOSE_KICK = 4005;
const TIME_SYNC_MS = 10000;
const IDLE_CHECK_MS = 10000;

/** Управление игроками: код комнаты, вход/выход, хост, лимиты, неактивность. Фазы — в PartyRoom. */
export abstract class PartyRoomCore<S extends CoreState> extends Room<S> {
  protected abstract readonly gameConfig: GameConfig;
  protected abstract createState(): S;
  /** Состав подключённых игроков изменился (вход/выход/обрыв). */
  protected abstract onRosterChanged(): void;
  onPlayerJoin?(playerId: string): void;
  onPlayerLeave?(playerId: string, consented: boolean): void;

  protected rateLimit: RateLimitConfig = DEFAULT_RATE_LIMIT;
  private readonly limiters = new Map<string, ClientLimiter>();
  private readonly sessionToPlayer = new Map<string, string>();
  private readonly lastActivity = new Map<string, number>();
  private readonly banned = new Set<string>();
  private readonly forced = new Set<string>();
  private code = '';

  get config(): GameConfig {
    return this.gameConfig;
  }

  /** Серверное время, мс. Можно переопределить (тесты). */
  now(): number {
    return Date.now();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onCreate(_options?: unknown): Promise<void> {
    // Запас под перепривязку (старый сокет ещё занимает место); лимит игроков проверяет onJoin (4004).
    this.maxClients = this.gameConfig.maxPlayers * 2;
    this.setState(this.createState());
    await this.reserveCode();
    this.state.code = this.code;
    this.state.totalRounds = this.gameConfig.rounds;
    this.clock.setInterval(() => this.broadcastTime(), TIME_SYNC_MS);
    this.clock.setInterval(() => this.kickIdle(), IDLE_CHECK_MS);
  }

  /** Colyseus 0.16: roomId можно задать только в onCreate; LocalPresence.sadd ничего не возвращает. */
  private async reserveCode(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      if (await this.presence.sismember(CODES_KEY, code)) continue;
      const added: unknown = await this.presence.sadd(CODES_KEY, code);
      if (added === 0) continue;
      this.code = code;
      this.roomId = code;
      return;
    }
    throw new ServerError(4010, 'no_code');
  }

  async onDispose(): Promise<void> {
    if (this.code) await this.presence.srem(CODES_KEY, this.code);
  }

  getPlayers(): IPlayer[] {
    return Array.from(this.state.players.values());
  }

  protected connectedCount(): number {
    return this.getPlayers().filter((p) => p.connected).length;
  }

  sendToPlayer(playerId: string, type: string, payload: unknown): void {
    this.clientOf(playerId)?.send(type, payload);
  }

  protected toast(key: string, params?: Record<string, string | number>, except?: Client): void {
    const msg: ServerMessages['core:toast'] = params ? { key, params } : { key };
    this.broadcast('core:toast', msg, except ? { except } : undefined);
  }

  protected clientOf(playerId: string): Client | undefined {
    const p = this.state.players.get(playerId);
    return p ? this.clients.find((c) => c.sessionId === p.sessionId) : undefined;
  }

  /** Проверка лимитов и привязки клиента к игроку. Возвращает playerId или null (сообщение отбросить). */
  protected admit(client: Client, isChat = false): string | null {
    const playerId = this.sessionToPlayer.get(client.sessionId);
    if (!playerId) return null;
    let lim = this.limiters.get(client.sessionId);
    if (!lim) {
      lim = new ClientLimiter(this.rateLimit);
      this.limiters.set(client.sessionId, lim);
    }
    const res = lim.check(this.now(), isChat);
    if (res.kick) this.kickClient(client, 'flood');
    if (!res.ok) return null;
    this.lastActivity.set(playerId, this.now());
    return playerId;
  }

  protected kickClient(client: Client, reason: ServerMessages['core:kicked']['reason']): void {
    this.forced.add(client.sessionId);
    client.send('core:kicked', { reason });
    client.leave(CLOSE_KICK);
  }

  /** Кик по решению хоста: игрок не сможет вернуться в эту комнату. */
  protected kickByHost(playerId: string): void {
    this.banned.add(playerId);
    const client = this.clientOf(playerId);
    if (client) {
      this.kickClient(client, 'host');
      return;
    }
    const p = this.state.players.get(playerId);
    if (p) this.finalizeLeave(p.sessionId, p);
  }

  private broadcastTime(): void {
    this.broadcast('core:time', { serverNow: this.now() } satisfies ServerMessages['core:time']);
  }

  private kickIdle(): void {
    if (this.state.phase !== 'lobby' && this.state.phase !== 'round') return;
    const limit = this.gameConfig.idleKickSec * 1000;
    for (const p of this.getPlayers()) {
      const last = this.lastActivity.get(p.id) ?? this.now();
      const client = p.connected ? this.clientOf(p.id) : undefined;
      if (client && this.now() - last > limit) this.kickClient(client, 'idle');
    }
  }

  async onJoin(client: Client, raw: Partial<JoinOptions> | undefined): Promise<void> {
    const opts = raw ?? {};
    const playerId = typeof opts.playerId === 'string' ? opts.playerId.slice(0, 64) : '';
    if (!playerId) throw new ServerError(4001, 'bad_options');
    if (this.banned.has(playerId)) throw new ServerError(4006, 'kicked');
    const players = this.state.players;
    let player = players.get(playerId);
    if (player) {
      this.rebind(player, client);
    } else {
      if (this.state.phase !== 'lobby') throw new ServerError(4003, 'started');
      if (players.size >= this.gameConfig.maxPlayers) throw new ServerError(4004, 'full');
      player = this.createPlayer(playerId, opts, players.size + 1);
      players.set(playerId, player);
      this.toast('core.toast.player_joined', { name: player.nick }, client);
    }
    player.sessionId = client.sessionId;
    this.sessionToPlayer.set(client.sessionId, playerId);
    this.lastActivity.set(playerId, this.now());
    const host = players.get(this.state.hostId);
    if (!host || !host.connected) this.state.hostId = playerId;
    client.send('core:time', { serverNow: this.now() } satisfies ServerMessages['core:time']);
    this.onPlayerJoin?.(playerId);
    this.onRosterChanged();
  }

  private createPlayer(id: string, o: Partial<JoinOptions>, index: number): Player {
    const p = new Player();
    p.id = id;
    p.nick = sanitizeNick(o.nick, index);
    p.avatar =
      typeof o.avatar === 'string' &&
      (AVATARS.includes(o.avatar) || PREMIUM_AVATARS.includes(o.avatar))
        ? o.avatar
        : (AVATARS[0] ?? '');
    const frame = o.cosmetics?.frame;
    p.frame = frame && FRAMES.includes(frame) ? frame : 'none';
    const color = o.cosmetics?.nickColor;
    p.nickColor = color && color in NICK_COLORS ? color : 'default';
    return p;
  }

  /** Перепривязка существующего игрока к новому соединению (очки сохраняются). */
  private rebind(player: Player, client: Client): void {
    const oldSession = player.sessionId;
    player.sessionId = client.sessionId; // старый onLeave увидит несовпадение и ничего не изменит
    player.connected = true;
    if (oldSession && oldSession !== client.sessionId) {
      this.sessionToPlayer.delete(oldSession);
      this.limiters.delete(oldSession);
      this.clients.find((c) => c.sessionId === oldSession)?.leave(CLOSE_CONSENTED);
    }
  }

  async onLeave(client: Client, consented?: boolean): Promise<void> {
    const playerId = this.sessionToPlayer.get(client.sessionId);
    const player = playerId ? this.state.players.get(playerId) : undefined;
    if (!playerId || !player || player.sessionId !== client.sessionId) return;
    const final = consented === true || this.forced.has(client.sessionId);
    player.connected = false;
    this.onPlayerLeave?.(playerId, final);
    this.onRosterChanged();
    if (!final) {
      try {
        await this.allowReconnection(client, this.gameConfig.reconnectSec);
        if (player.sessionId === client.sessionId) {
          player.connected = true;
          this.lastActivity.set(playerId, this.now());
          this.onRosterChanged();
        }
        return;
      } catch {
        if (player.sessionId !== client.sessionId || player.connected) return;
      }
    }
    this.finalizeLeave(client.sessionId, player);
  }

  private finalizeLeave(sessionId: string, player: Player): void {
    this.sessionToPlayer.delete(sessionId);
    this.limiters.delete(sessionId);
    this.forced.delete(sessionId);
    this.lastActivity.delete(player.id);
    player.connected = false;
    if (this.state.phase === 'lobby') this.state.players.delete(player.id);
    this.toast('core.toast.player_left', { name: player.nick });
    if (this.state.hostId === player.id) this.pickHost();
    this.onRosterChanged();
  }

  /** Хост уходит окончательно: следующий подключённый по порядку входа. */
  private pickHost(): void {
    const next = this.getPlayers().find((p) => p.connected && p.id !== this.state.hostId);
    this.state.hostId = next?.id ?? '';
    if (next) this.toast('core.toast.host_changed', { name: next.nick });
  }
}
