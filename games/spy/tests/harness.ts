import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import { SpyRoom } from '../server/SpyRoom.js';
import {
  MSG_CALL_VOTE,
  MSG_ROLE,
  MSG_SEEN,
  MSG_VOTE,
  gameConfig,
  type SpyRoleMessage,
} from '../shared/index.js';

/** Все стадии короткие: проверка переходов по таймерам. */
export class FastRoom extends SpyRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 250,
    roundEndMs: 700,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
  protected readonly stageMs = { discussion: 300, voting: 300, lastChance: 300 };
  protected rateLimit = { ...DEFAULT_RATE_LIMIT, capacity: 1000, refillPerSec: 1000 };
}

/** Длинные стадии: всё идёт досрочно, по событиям. */
export class SlowRoom extends FastRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 4000,
    roundEndMs: 300,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
  protected readonly stageMs = { discussion: 4000, voting: 4000, lastChance: 4000 };
}

/** Как SlowRoom, но последний шанс короткий. */
export class ChanceRoom extends SlowRoom {
  protected readonly stageMs = { discussion: 4000, voting: 4000, lastChance: 300 };
}

export interface View {
  phase: string;
  round: number;
  totalRounds: number;
  phaseEndsAt: number;
  hostId: string;
  rounds: number;
  packs: string[];
  stage: string;
  board: string[];
  askerId: string;
  targetId: string;
  lastAskerId: string;
  questions: number;
  seen: string[];
  voteCalls: string[];
  voted: string[];
  spyId: string;
  locationId: string;
  accusedId: string;
  guessId: string;
  outcome: string;
  votes: Map<string, string>;
  players: Map<string, { score: number; roundScore: number; connected: boolean }>;
}

export interface Bot {
  id: string;
  room: Room<unknown>;
  roles: SpyRoleMessage[];
}

export const st = (b: Bot): View => b.room.state as unknown as View;
export const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const send = (b: Bot, type: string, payload: object = {}): void =>
  b.room.send(type, payload);
export const last = (b: Bot): SpyRoleMessage => b.roles[b.roles.length - 1] as SpyRoleMessage;
export const opts = (id: string): object => ({
  playerId: id,
  nick: id,
  avatar: '\u{1F436}',
  lang: 'ru',
});
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  for (;;) {
    let ok = false;
    try {
      ok = pred();
    } catch {
      /* состояние ещё не пришло */
    }
    if (ok) return;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await pause(10);
  }
}

export function track(id: string, room: Room<unknown>): Bot {
  const bot: Bot = { id, room, roles: [] };
  room.onMessage(MSG_ROLE, (m: SpyRoleMessage) => bot.roles.push(m));
  return bot;
}

export async function join(server: ColyseusTestServer, name: string, n: number): Promise<Bot[]> {
  const bots: Bot[] = [];
  for (let i = 0; i < n; i++) {
    const id = NAMES[i] as string;
    const first = bots[0];
    const room = first
      ? await server.sdk.joinById(first.room.roomId, opts(id))
      : await server.sdk.create(name, opts(id));
    bots.push(track(id, room));
  }
  await waitFor(() => st(bots[0] as Bot).players.size === n);
  return bots;
}

export interface RoundInfo {
  spy: Bot;
  others: Bot[];
  location: string;
  /** Первая роль раунда у бота. */
  role(b: Bot): SpyRoleMessage;
}

/** Ждёт старт раунда и роли у всех; роли берутся по номеру раунда. */
export async function beginRound(bots: Bot[], round: number): Promise<RoundInfo> {
  const a = bots[0] as Bot;
  await waitFor(() => st(a).phase === 'round' && st(a).round === round);
  const role = (b: Bot): SpyRoleMessage => b.roles.find((r) => r.round === round) as SpyRoleMessage;
  await waitFor(() => bots.every((b) => b.roles.some((r) => r.round === round)));
  const spy = bots.find((b) => role(b).spy) as Bot;
  const others = bots.filter((b) => b !== spy);
  return { spy, others, location: role(others[0] as Bot).locationId as string, role };
}

/** Все нажали «Понял» → discussion. */
export async function toDiscussion(bots: Bot[]): Promise<void> {
  for (const b of bots) send(b, MSG_SEEN);
  await waitFor(() => st(bots[0] as Bot).stage === 'discussion');
}

export const roundEnd = (a: Bot, ms = 1500): Promise<void> =>
  waitFor(() => st(a).phase === 'roundEnd', ms);
export const stage = (a: Bot, s: string, ms = 1500): Promise<void> =>
  waitFor(() => st(a).stage === s, ms);
export const board = (a: Bot): string[] => [...st(a).board];
export const scores = (a: Bot, bots: Bot[]): Record<string, number> =>
  Object.fromEntries(bots.map((b) => [b.id, st(a).players.get(b.id)?.roundScore ?? -1]));

/** voter id → target id. */
export const castVotes = (bots: Bot[], m: Record<string, string>): void =>
  bots.forEach((b) => m[b.id] && send(b, MSG_VOTE, { targetId: m[b.id] }));

/** `callers` первых игроков зовут голосование → стадия voting. */
export async function toVoting(bots: Bot[], callers = 2): Promise<void> {
  bots.slice(0, callers).forEach((b) => send(b, MSG_CALL_VOTE, { on: true }));
  await stage(bots[0] as Bot, 'voting');
}

/** Комната на n игроков, старт игры, первый раунд; discuss — сразу в discussion. */
export async function startGame(
  server: ColyseusTestServer,
  name: string,
  n: number,
  discuss = true,
): Promise<RoundInfo & { bots: Bot[]; a: Bot }> {
  const bots = await join(server, name, n);
  const a = bots[0] as Bot;
  send(a, 'core:start');
  const info = await beginRound(bots, 1);
  if (discuss) await toDiscussion(bots);
  return { ...info, bots, a };
}

/** Неверная локация с поля (не настоящая). */
export const wrongGuess = (a: Bot, location: string): string =>
  board(a).find((id) => id !== location) as string;

/** Тестовый сервер на порту 2572 с комнатами fast / slow / chance. */
export const bootSpy = (): Promise<ColyseusTestServer> =>
  boot(
    {
      initializeGameServer: (gs) => {
        gs.define('fast', FastRoom);
        gs.define('slow', SlowRoom);
        gs.define('chance', ChanceRoom);
      },
    },
    2572,
  );
