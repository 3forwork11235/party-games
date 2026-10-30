import type { ColyseusTestServer } from '@colyseus/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BOARD_SIZE, PACKS } from '../shared/index.js';
import * as M from '../shared/messages.js';
import {
  beginRound,
  bootSpy,
  board,
  castVotes,
  join,
  last,
  opts,
  pause,
  roundEnd,
  scores,
  send,
  st,
  stage,
  startGame,
  toDiscussion,
  toVoting,
  track,
  waitFor,
  wrongGuess,
  type Bot,
} from './harness.js';

let server: ColyseusTestServer;
beforeAll(async () => {
  server = await bootSpy();
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

const result = (a: Bot): unknown[] => [st(a).outcome, st(a).accusedId, st(a).guessId];

describe('SpyRoom', () => {
  it('полный цикл 3 игроков x 3 раунда: скрытое, роли, исходы, очки', async () => {
    const bots = await join(server, 'slow', 3);
    const a = bots[0] as Bot;
    send(a, M.MSG_SETTINGS, { packIds: ['city', 'travel'], rounds: 3 });
    await waitFor(() => st(a).rounds === 3);
    send(a, 'core:start');
    const spies = new Set<string>();
    for (let round = 1; round <= 3; round++) {
      const { spy, others, location, role } = await beginRound(bots, round);
      const [x, y] = others as [Bot, Bot];
      spies.add(spy.id);
      const s = st(a);
      expect([s.totalRounds, s.stage]).toEqual([3, 'roles']);
      expect([s.spyId, s.locationId, s.accusedId, s.outcome]).toEqual(['', '', '', '']);
      expect(board(a)).toHaveLength(BOARD_SIZE);
      expect(board(a)).toContain(location);
      expect(s.votes.size).toBe(0);
      expect(role(spy)).toEqual({ round, spy: true, crossed: [], hintsLeft: 2 });
      expect(others.map((o) => role(o).locationId)).toEqual([location, location]);
      expect(new Set(others.map((o) => role(o).roleIndex)).size).toBe(2);
      await toDiscussion(bots);
      if (round === 1) {
        await toVoting(bots);
        castVotes(bots, { [x.id]: spy.id, [y.id]: spy.id, [spy.id]: x.id });
        await stage(a, 'lastChance');
        send(spy, M.MSG_GUESS, { locationId: location });
        await roundEnd(a);
        expect(result(a)).toEqual(['spy_guessed', spy.id, location]);
        expect(scores(a, bots)).toEqual({ [spy.id]: 4, [x.id]: 1, [y.id]: 1 });
      } else if (round === 2) {
        await toVoting(bots);
        castVotes(bots, { [x.id]: spy.id, [y.id]: x.id, [spy.id]: y.id });
        await roundEnd(a);
        expect(result(a)).toEqual(['spy_escaped', '', '']);
        expect(scores(a, bots)).toEqual({ [spy.id]: 2, [x.id]: 1, [y.id]: 0 });
        expect(s.votes.get(y.id)).toBe(x.id);
      } else {
        const wrong = wrongGuess(a, location);
        send(spy, M.MSG_GUESS, { locationId: wrong });
        await roundEnd(a);
        expect(result(a)).toEqual(['spy_wrong', '', wrong]);
        expect(scores(a, bots)).toEqual({ [spy.id]: 0, [x.id]: 1, [y.id]: 1 });
      }
      expect([s.spyId, s.locationId, s.stage]).toEqual([spy.id, location, '']);
      if (round < 3) {
        await waitFor(() => st(a).phase === 'adBreak');
        bots.forEach((b) => send(b, 'core:adDone'));
      }
    }
    await waitFor(() => st(a).phase === 'results');
    expect(bots.reduce((sum, b) => sum + (st(a).players.get(b.id)?.score ?? 0), 0)).toBe(11);
    expect(spies.size).toBe(3);
  }, 20000);

  it('стадии идут по таймерам; без голосов — spy_escaped', async () => {
    const { a, bots, spy } = await startGame(server, 'fast', 3, false);
    await stage(a, 'discussion');
    const t1 = st(a).phaseEndsAt;
    await stage(a, 'voting');
    expect(st(a).phaseEndsAt).toBeGreaterThan(t1);
    await roundEnd(a);
    expect([...result(a), st(a).spyId]).toEqual(['spy_escaped', '', '', spy.id]);
    expect(scores(a, bots)[spy.id]).toBe(2);
  });

  it('последний шанс: время вышло → spy_caught', async () => {
    const { a, bots, spy, others } = await startGame(server, 'chance', 3);
    const [x, y] = others as [Bot, Bot];
    await toVoting(bots);
    castVotes(bots, { [x.id]: spy.id, [y.id]: spy.id, [spy.id]: x.id });
    await stage(a, 'lastChance');
    await roundEnd(a);
    expect(result(a)).toEqual(['spy_caught', spy.id, '']);
    expect(scores(a, bots)).toEqual({ [spy.id]: 0, [x.id]: 2, [y.id]: 2 });
  });

  it('догадка: вне стадии/не шпион/не с поля игнорируется; неверная досрочная → spy_wrong', async () => {
    const { a, bots, spy, others, location } = await startGame(server, 'slow', 3, false);
    send(spy, M.MSG_GUESS, { locationId: location }); // стадия roles
    await toDiscussion(bots);
    await pause(80);
    expect(st(a).phase).toBe('round');
    send(others[0] as Bot, M.MSG_GUESS, { locationId: location });
    send(spy, M.MSG_GUESS, { locationId: 'bogus/1' });
    send(spy, M.MSG_GUESS, { locationId: 'space/3' }); // платный пак не на поле
    await pause(80);
    expect(st(a).phase).toBe('round');
    const wrong = wrongGuess(a, location);
    send(spy, M.MSG_GUESS, { locationId: wrong });
    await roundEnd(a);
    expect(result(a)).toEqual(['spy_wrong', '', wrong]);
  });

  it('подсказки: только шпион, не в roles, максимум 2, hello повторяет', async () => {
    const { a, bots, spy, others, location } = await startGame(server, 'slow', 3, false);
    const x = others[0] as Bot;
    send(spy, M.MSG_HINT); // стадия roles
    await toDiscussion(bots);
    send(x, M.MSG_HINT);
    await pause(80);
    expect([spy.roles.length, x.roles.length]).toEqual([1, 1]);
    send(spy, M.MSG_HINT);
    await waitFor(() => spy.roles.length === 2);
    const first = last(spy).crossed;
    expect([last(spy).hintsLeft, first.length]).toEqual([1, 6]);
    expect(first).not.toContain(location);
    expect(first.every((id) => board(a).includes(id))).toBe(true);
    send(spy, M.MSG_HINT);
    await waitFor(() => spy.roles.length === 3);
    expect([last(spy).hintsLeft, last(spy).crossed.length]).toEqual([0, 12]);
    expect(last(spy).crossed.slice(0, 6)).toEqual(first);
    send(spy, M.MSG_HINT);
    await pause(100);
    expect(spy.roles).toHaveLength(3);
    send(spy, M.MSG_HELLO);
    await waitFor(() => spy.roles.length === 4);
    expect(last(spy)).toEqual(spy.roles[2]);
  });

  it('очередь вопросов: валидация, «Ответил» от цели, передача хода', async () => {
    const { a, bots } = await startGame(server, 'slow', 3);
    const asker = bots.find((b) => b.id === st(a).askerId) as Bot;
    const [p, q] = bots.filter((b) => b !== asker) as [Bot, Bot];
    send(p, M.MSG_ASK, { targetId: q.id });
    send(asker, M.MSG_ASK, { targetId: asker.id });
    send(asker, M.MSG_ASK, { targetId: 'ZZ' });
    await pause(80);
    expect(st(a).targetId).toBe('');
    send(asker, M.MSG_ASK, { targetId: p.id });
    await waitFor(() => st(a).targetId === p.id);
    send(asker, M.MSG_ASK, { targetId: q.id });
    send(q, M.MSG_ANSWERED);
    await pause(80);
    expect([st(a).targetId, st(a).questions]).toEqual([p.id, 0]);
    send(p, M.MSG_ANSWERED);
    await waitFor(() => st(a).askerId === p.id);
    expect([st(a).lastAskerId, st(a).targetId, st(a).questions]).toEqual([asker.id, '', 1]);
    send(p, M.MSG_ASK, { targetId: asker.id }); // нельзя тому, кто только что спрашивал
    await pause(80);
    expect(st(a).targetId).toBe('');
    send(p, M.MSG_ASK, { targetId: q.id });
    await waitFor(() => st(a).targetId === q.id);
    send(bots.find((b) => b !== p && b.id !== 'A') as Bot, M.MSG_PASS);
    await pause(80);
    expect(st(a).askerId).toBe(p.id);
    send(a, M.MSG_PASS); // хост передаёт ход следующему по порядку входа
    const next = bots[(bots.indexOf(p) + 1) % 3] as Bot;
    await waitFor(() => st(a).askerId === next.id);
    expect([st(a).targetId, st(a).lastAskerId]).toEqual(['', '']);
  });

  it('досрочное голосование (> половины), ввод голосов, невиновный обвинён', async () => {
    const { a, bots, spy, others } = await startGame(server, 'slow', 3);
    const [x, y] = others as [Bot, Bot];
    send(a, M.MSG_CALL_VOTE, { on: true });
    await waitFor(() => st(a).voteCalls.length === 1);
    send(a, M.MSG_CALL_VOTE, { on: false });
    await waitFor(() => st(a).voteCalls.length === 0);
    send(a, M.MSG_CALL_VOTE, { on: true });
    await pause(80);
    expect(st(a).stage).toBe('discussion'); // 1 из 3 — не больше половины
    send(bots[1] as Bot, M.MSG_CALL_VOTE, { on: true });
    await stage(a, 'voting');
    expect(st(a).voteCalls.length).toBe(0);
    castVotes(bots, { [x.id]: x.id }); // за себя нельзя
    send(x, M.MSG_VOTE, { targetId: 'ZZ' });
    await pause(80);
    expect(st(a).voted.length).toBe(0);
    castVotes(bots, { [x.id]: y.id });
    await waitFor(() => st(a).voted.length === 1);
    castVotes(bots, { [x.id]: spy.id }); // повтор перезаписывает
    send(y, M.MSG_VOTE, { targetId: x.id });
    await waitFor(() => st(a).voted.length === 2);
    expect(st(a).votes.size).toBe(0);
    send(spy, M.MSG_VOTE, { targetId: x.id }); // все проголосовали → досрочно, а не через 4 с
    await roundEnd(a);
    expect(result(a)).toEqual(['spy_escaped', x.id, '']);
    expect(scores(a, bots)).toEqual({ [spy.id]: 2, [x.id]: 1, [y.id]: 0 });
    expect([...st(a).votes.keys()].sort()).toEqual(['A', 'B', 'C']);
  });

  it('ушли цель и спрашивающий — ход идёт дальше; последний непроголосовавший ушёл → итог', async () => {
    const { a, bots } = await startGame(server, 'slow', 5);
    const asker = bots.find((b) => b.id === st(a).askerId) as Bot;
    const [p, q, r, s] = bots.filter((b) => b !== asker) as [Bot, Bot, Bot, Bot];
    send(asker, M.MSG_ASK, { targetId: p.id });
    await waitFor(() => st(q).targetId === p.id);
    await p.room.leave(true);
    await waitFor(() => st(q).targetId === '');
    await asker.room.leave(true);
    await waitFor(() => st(q).askerId !== asker.id);
    expect([q.id, r.id, s.id]).toContain(st(q).askerId);
    expect([st(q).phase, st(q).stage]).toEqual(['round', 'discussion']);
    await toVoting([q, r, s]);
    const other = (b: Bot): string => (b.id === 'A' ? 'B' : 'A');
    castVotes([q, r], { [q.id]: other(q), [r.id]: other(r) });
    await waitFor(() => st(q).voted.length === 2);
    await s.room.leave(true);
    await waitFor(() => st(q).stage !== 'voting');
  });

  it('spy:hello и повторный вход после обрыва возвращают роль', async () => {
    const { bots, others, role } = await startGame(server, 'slow', 3, false);
    const x = others[0] as Bot;
    const w = bots.find((b) => b !== x) as Bot; // наблюдатель, который не отключается
    send(x, M.MSG_HELLO);
    await waitFor(() => x.roles.length === 2);
    expect(x.roles[1]).toEqual(role(x));
    await x.room.leave(false);
    await waitFor(() => st(w).players.get(x.id)?.connected === false);
    const back = track(x.id, await server.sdk.joinById(w.room.roomId, opts(x.id)));
    await waitFor(() => st(w).players.get(x.id)?.connected === true);
    send(back, M.MSG_HELLO);
    await waitFor(() => back.roles.length >= 1);
    expect(last(back)).toEqual(role(x));
  });

  it('settings: только хост, валидация, rounds → totalRounds', async () => {
    const [a, b] = (await join(server, 'fast', 3)) as [Bot, Bot, Bot];
    expect([...st(a).packs]).toEqual(['city', 'travel', 'leisure']);
    expect(st(a).rounds).toBe(5);
    send(b, M.MSG_SETTINGS, { packIds: ['movies'], rounds: 3 });
    send(a, M.MSG_SETTINGS, { packIds: ['bogus'], rounds: 3 });
    send(a, M.MSG_SETTINGS, { packIds: [], rounds: 3 });
    send(a, M.MSG_SETTINGS, { packIds: ['city'], rounds: 4 });
    send(a, M.MSG_SETTINGS, { packIds: 'city', rounds: 3 });
    await pause(100);
    expect([[...st(a).packs].length, st(a).rounds]).toEqual([3, 5]);
    send(a, M.MSG_SETTINGS, { packIds: ['movies', 'space', 'movies'], rounds: 8 });
    await waitFor(() => st(a).rounds === 8);
    expect([...st(a).packs]).toEqual(['movies', 'space']);
    send(a, M.MSG_SETTINGS, { packIds: PACKS.map((p) => p.id), rounds: 3 });
    await waitFor(() => st(a).packs.length === 6);
    expect(st(a).totalRounds).toBe(5);
    send(a, 'core:start');
    await waitFor(() => st(a).totalRounds === 3);
  });

  it('8 игроков: раунд до конца, 9-й получает full', async () => {
    const { a, bots, spy, others, location, role } = await startGame(server, 'slow', 8);
    await expect(server.sdk.joinById(a.room.roomId, opts('I'))).rejects.toThrow();
    expect(new Set(others.map((o) => role(o).roleIndex)).size).toBe(7);
    expect(new Set(others.map((o) => role(o).locationId))).toEqual(new Set([location]));
    bots.slice(0, 4).forEach((b) => send(b, M.MSG_CALL_VOTE, { on: true }));
    await waitFor(() => st(a).voteCalls.length === 4);
    await pause(80);
    expect(st(a).stage).toBe('discussion'); // 4 из 8 — не больше половины
    send(bots[4] as Bot, M.MSG_CALL_VOTE, { on: true });
    await stage(a, 'voting');
    castVotes(
      bots,
      Object.fromEntries(bots.map((b) => [b.id, b === spy ? (others[0] as Bot).id : spy.id])),
    );
    await stage(a, 'lastChance');
    const wrong = wrongGuess(a, location);
    send(spy, M.MSG_GUESS, { locationId: wrong });
    await roundEnd(a);
    expect(result(a)).toEqual(['spy_caught', spy.id, wrong]);
    expect(Object.values(scores(a, bots)).sort()).toEqual([0, 2, 2, 2, 2, 2, 2, 2]);
  });
});
