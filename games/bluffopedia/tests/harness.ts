import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { DEFAULT_RATE_LIMIT } from '@party/core/shared';
import type { BankQuestion } from '../server/bank.js';
import { BluffRoom } from '../server/BluffRoom.js';
import { MSG_YOU, gameConfig, type YouMessage } from '../shared/index.js';

export const TRUTH = 'Truth';
const RECORD: BankQuestion = {
  q: 'The answer is ___',
  a: TRUTH,
  alt: ['The Truth'],
  fake: ['house1', 'house2', 'house3'],
};

/** Банк подменён: каждый вопрос — один и тот же, без файлов контента. */
class TestRoom extends BluffRoom {
  protected question(): BankQuestion | null {
    return { ...RECORD, alt: [...RECORD.alt], fake: [...RECORD.fake] };
  }
  async onCreate(options?: unknown): Promise<void> {
    await super.onCreate(options);
    this.state.rounds = 2;
  }
  protected rateLimit = { ...DEFAULT_RATE_LIMIT, capacity: 1000, refillPerSec: 1000 };
}

/** Короткие стадии: проверка переходов по таймерам. */
export class FastRoom extends TestRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 250,
    roundEndMs: 600,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
  protected readonly stageMs = { vote: 250 };
}

/** Длинные стадии: всё идёт досрочно, по событиям. */
export class SlowRoom extends TestRoom {
  protected readonly gameConfig = {
    ...gameConfig,
    countdownMs: 40,
    roundMs: 4000,
    roundEndMs: 300,
    adBreakMinMs: 20,
    adBreakMaxMs: 300,
  };
  protected readonly stageMs = { vote: 4000 };
}

export interface View {
  phase: string;
  round: number;
  totalRounds: number;
  hostId: string;
  rounds: number;
  lang: string;
  packs: string[];
  stage: string;
  questionId: string;
  category: string;
  question: string;
  submitted: string[];
  voted: string[];
  options: { id: string; text: string }[];
  truthId: string;
  lies: Map<string, string>;
  votes: Map<string, string>;
  players: Map<string, { score: number; roundScore: number; connected: boolean }>;
}

export interface Bot {
  id: string;
  room: Room<unknown>;
  you: YouMessage[];
  toasts: string[];
}

export const st = (b: Bot): View => b.room.state as unknown as View;
export const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const send = (b: Bot, type: string, payload: object = {}): void =>
  b.room.send(type, payload);
export const lastYou = (b: Bot): YouMessage => b.you[b.you.length - 1] as YouMessage;
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
  const bot: Bot = { id, room, you: [], toasts: [] };
  room.onMessage(MSG_YOU, (m: YouMessage) => bot.you.push(m));
  room.onMessage('core:toast', (m: { key: string }) => {
    if (m.key.startsWith('bluff.')) bot.toasts.push(m.key);
  });
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

export const stage = (a: Bot, s: string, ms = 1500): Promise<void> =>
  waitFor(() => st(a).stage === s, ms);
export const roundEnd = (a: Bot, ms = 1500): Promise<void> =>
  waitFor(() => st(a).phase === 'roundEnd', ms);
export const scores = (a: Bot, bots: Bot[]): Record<string, number> =>
  Object.fromEntries(bots.map((b) => [b.id, st(a).players.get(b.id)?.roundScore ?? -1]));
export const optionByText = (a: Bot, text: string): string =>
  st(a).options.find((o) => o.text === text)?.id ?? '';

/** Ждёт начало раунда с идентичным stage='write'. */
export async function beginRound(a: Bot, round: number): Promise<void> {
  await waitFor(() => st(a).phase === 'round' && st(a).round === round && st(a).stage === 'write');
}

/** Комната на n игроков, старт игры, первый раунд (stage write). */
export async function startGame(
  server: ColyseusTestServer,
  name: string,
  n: number,
): Promise<{ bots: Bot[]; a: Bot }> {
  const bots = await join(server, name, n);
  const a = bots[0] as Bot;
  send(a, 'core:start');
  await beginRound(a, 1);
  return { bots, a };
}

/** Тестовый сервер на порту 2573 с комнатами fast / slow. */
export const bootBluff = (): Promise<ColyseusTestServer> =>
  boot(
    {
      initializeGameServer: (gs) => {
        gs.define('fast', FastRoom);
        gs.define('slow', SlowRoom);
      },
    },
    2573,
  );
