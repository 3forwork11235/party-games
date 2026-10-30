import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CoreState } from '../src/server/index.js';
import { TestRoom, opts, st, waitFor } from './helpers.js';

type HookMode = 'restart' | 'false' | 'endTrue' | 'endFalse';

/** Комната с хуком onRoundTimeout: поведение задаёт тест через mode. */
class HookRoom extends TestRoom {
  mode: HookMode = 'false';
  timeouts = 0;
  readonly ended: number[] = [];
  onRoundTimeout(): boolean {
    this.timeouts++;
    if (this.mode === 'restart') this.restartRound(5000);
    else if (this.mode === 'endTrue' || this.mode === 'endFalse') this.endRound();
    return this.mode === 'restart' || this.mode === 'endTrue';
  }
  onRoundEnd(): Record<string, number> {
    this.ended.push(this.state.round);
    return super.onRoundEnd();
  }
}

let server: ColyseusTestServer;

beforeAll(async () => {
  server = await boot(
    {
      initializeGameServer: (gs) => {
        gs.define('test', TestRoom);
        gs.define('hook', HookRoom);
      },
    },
    2571,
  );
});
afterAll(async () => {
  await server.shutdown();
});
afterEach(async () => {
  await server.cleanup();
});

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('PartyRoom.restartRound', () => {
  it('в round сдвигает phaseEndsAt, раунд не кончается по старому таймеру', async () => {
    const a = await server.sdk.create('test', opts('p1'));
    const b = await server.sdk.joinById(a.roomId, opts('p2'));
    await waitFor(() => st(b).players.size === 2);
    const room = server.getRoomById<CoreState>(a.roomId) as unknown as TestRoom;
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'round');
    const before = room.state.phaseEndsAt;
    await pause(150);
    room.restartRound();
    expect(room.state.phaseEndsAt).toBeGreaterThan(before + 100);
    await pause(200); // старый таймер (300 мс от начала) уже сработал бы
    expect(room.state.phase).toBe('round');
    await waitFor(() => room.state.phase === 'roundEnd', 2000);
  });

  it('вне round — no-op', async () => {
    const a = await server.sdk.create('test', opts('p1'));
    const room = server.getRoomById<CoreState>(a.roomId) as unknown as TestRoom;
    const before = room.state.phaseEndsAt;
    room.restartRound();
    expect(room.state.phase).toBe('lobby');
    expect(room.state.phaseEndsAt).toBe(before);
  });

  it('restartRound(ms) ставит phaseEndsAt = now + ms', async () => {
    const a = await server.sdk.create('test', opts('p1'));
    const b = await server.sdk.joinById(a.roomId, opts('p2'));
    await waitFor(() => st(b).players.size === 2);
    const room = server.getRoomById<CoreState>(a.roomId) as unknown as TestRoom;
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'round');
    const t0 = room.now();
    room.restartRound(5000);
    const t1 = room.now();
    expect(room.state.phaseEndsAt).toBeGreaterThanOrEqual(t0 + 5000);
    expect(room.state.phaseEndsAt).toBeLessThanOrEqual(t1 + 5000);
    await pause(400); // исходный таймер раунда (300 мс) сброшен
    expect(room.state.phase).toBe('round');
  });
});

async function startHookRoom(mode: HookMode): Promise<{ room: HookRoom; phase: () => string }> {
  const a = await server.sdk.create('hook', opts('p1'));
  const b = await server.sdk.joinById(a.roomId, opts('p2'));
  await waitFor(() => st(b).players.size === 2);
  const room = server.getRoomById<CoreState>(a.roomId) as unknown as HookRoom;
  room.mode = mode;
  a.send('core:start', {});
  await waitFor(() => st(a).phase === 'round');
  return { room, phase: () => room.state.phase };
}

describe('PartyRoom.onRoundTimeout', () => {
  it('нет хука — раунд завершается по таймауту', async () => {
    const a = await server.sdk.create('test', opts('p1'));
    const b = await server.sdk.joinById(a.roomId, opts('p2'));
    await waitFor(() => st(b).players.size === 2);
    a.send('core:start', {});
    await waitFor(() => st(a).phase === 'round');
    await waitFor(() => st(a).phase === 'roundEnd', 2000);
  });

  it('хук вернул false — раунд завершается', async () => {
    const { room, phase } = await startHookRoom('false');
    await waitFor(() => phase() === 'roundEnd', 2000);
    expect(room.timeouts).toBe(1);
    expect(room.ended).toEqual([1]);
  });

  it('хук вернул true после restartRound(ms) — раунд продолжается', async () => {
    const { room, phase } = await startHookRoom('restart');
    await waitFor(() => room.timeouts === 1, 2000);
    await pause(100);
    expect(phase()).toBe('round');
    expect(room.ended).toEqual([]);
    expect(room.state.phaseEndsAt).toBeGreaterThan(room.now() + 4000);
  });

  it.each(['endTrue', 'endFalse'] as const)(
    'хук сам вызвал endRound() (%s) — ровно один onRoundEnd',
    async (mode) => {
      const { room, phase } = await startHookRoom(mode);
      await waitFor(() => phase() === 'roundEnd', 2000);
      expect(room.ended).toEqual([1]);
      // дошли до следующего раунда: onRoundEnd первого раунда не повторился
      await waitFor(() => room.state.round === 2 && phase() === 'round', 3000);
      expect(room.ended).toEqual([1]);
    },
  );
});
