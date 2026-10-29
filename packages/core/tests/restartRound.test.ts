import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CoreState } from '../src/server/index.js';
import { TestRoom, opts, st, waitFor } from './helpers.js';

let server: ColyseusTestServer;

beforeAll(async () => {
  server = await boot(
    {
      initializeGameServer: (gs) => {
        gs.define('test', TestRoom);
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
});
