import type { ColyseusTestServer } from '@colyseus/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as M from '../shared/messages.js';
import {
  TRUTH,
  bootBluff,
  join,
  lastYou,
  optionByText,
  opts,
  pause,
  roundEnd,
  scores,
  send,
  st,
  stage,
  startGame,
  waitFor,
  type Bot,
} from './harness.js';

let server: ColyseusTestServer;
beforeAll(async () => {
  server = await bootBluff();
});
afterAll(async () => server.shutdown());
afterEach(async () => server.cleanup());

const lie = (b: Bot, text: string): void => send(b, M.MSG_LIE, { text });
const vote = (b: Bot, optionId: string): void => send(b, M.MSG_VOTE, { optionId });

describe('BluffRoom', () => {
  it('полный цикл 3 игроков x 2 раунда: скрытое до roundEnd, слияние, очки', async () => {
    const bots = await join(server, 'slow', 3);
    const [a, b, c] = bots as [Bot, Bot, Bot];
    send(a, 'core:start');
    await waitFor(() => st(a).phase === 'round' && st(a).stage === 'write');
    expect(st(a).totalRounds).toBe(2);
    expect(st(a).question).toBe('The answer is ___');
    expect(st(a).category).toBe(st(a).questionId.split('/')[0]);

    lie(a, 'x1');
    lie(b, 'X1!'); // сливается с выдумкой A
    await pause(80);
    expect([...st(a).submitted].sort()).toEqual(['A', 'B']);
    expect(st(a).options).toHaveLength(0);
    lie(c, 'z');
    await stage(a, 'vote');
    expect(st(a).options.map((o) => o.id)).toEqual(['o1', 'o2', 'o3', 'o4']); // 3 + 1 выдумка игры
    expect([st(a).truthId, st(a).lies.size, st(a).votes.size]).toEqual(['', 0, 0]);
    expect(Object.keys(st(a).options[0] as object).sort()).toEqual(['id', 'text']);
    expect(lastYou(a).lie).toBe('x1');
    expect(lastYou(a).ownId).toBe(optionByText(a, 'x1'));
    expect(lastYou(c).ownId).toBe(optionByText(a, 'z'));

    vote(a, optionByText(a, TRUTH));
    vote(b, optionByText(a, 'z'));
    vote(c, optionByText(a, 'x1'));
    await roundEnd(a);
    expect(scores(a, bots)).toEqual({ A: 3, B: 1, C: 1 });
    expect(st(a).truthId).toBe(optionByText(a, TRUTH));
    expect([st(a).lies.get('A'), st(a).lies.get('B')]).toEqual(Array(2).fill(optionByText(a, 'x1')));
    expect(st(a).lies.get('C')).toBe(optionByText(a, 'z'));
    expect(st(a).votes.get('C')).toBe(optionByText(a, 'x1'));
    expect(st(a).stage).toBe('');

    await waitFor(() => st(a).phase === 'adBreak');
    bots.forEach((x) => send(x, 'core:adDone'));
    await waitFor(() => st(a).phase === 'round' && st(a).round === 2 && st(a).stage === 'write');
    expect([st(a).truthId, st(a).lies.size, st(a).options.length, st(a).submitted.length]).toEqual([
      '',
      0,
      0,
      0,
    ]);
    bots.forEach((x) => lie(x, `own ${x.id}`));
    await stage(a, 'vote');
    bots.forEach((x) => vote(x, optionByText(a, TRUTH)));
    await roundEnd(a);
    expect(scores(a, bots)).toEqual({ A: 2, B: 2, C: 2 });
    await waitFor(() => st(a).phase === 'results');
    expect(bots.map((x) => st(a).players.get(x.id)?.score)).toEqual([5, 3, 3]);
  }, 20000);

  it('выдумка = правде и пустая отклоняются с toast', async () => {
    const { a, bots } = await startGame(server, 'slow', 3);
    const b = bots[1] as Bot;
    lie(b, 'the TRUTH!');
    lie(b, '   ');
    lie(b, 'Truth');
    await waitFor(() => b.toasts.length === 3);
    expect(b.toasts).toEqual(['bluff.toast.truth', 'bluff.toast.empty', 'bluff.toast.truth']);
    expect(st(a).submitted).toHaveLength(0);
    lie(b, 'fine');
    await waitFor(() => st(a).submitted.length === 1);
    lie(b, 'fine 2'); // повтор перезаписывает
    await waitFor(() => lastYou(b).lie === 'fine 2');
    expect(st(a).submitted).toHaveLength(1);
  });

  it('стадии идут по таймерам; без выдумок и голосов — 0 очков', async () => {
    const { a, bots } = await startGame(server, 'fast', 3);
    await stage(a, 'vote');
    expect(st(a).options).toHaveLength(4);
    expect(st(a).options.filter((o) => o.text === TRUTH)).toHaveLength(1);
    await roundEnd(a);
    expect(scores(a, bots)).toEqual({ A: 0, B: 0, C: 0 });
    expect(st(a).truthId).not.toBe('');
  });

  it('досрочно write→vote и vote→roundEnd; нельзя голосовать за своё', async () => {
    const { a, bots } = await startGame(server, 'slow', 3);
    const [b, c] = [bots[1], bots[2]] as [Bot, Bot];
    bots.forEach((x) => lie(x, `lie ${x.id}`));
    await stage(a, 'vote');
    const own = optionByText(a, 'lie B');
    expect(lastYou(b).ownId).toBe(own);
    vote(b, own); // свой — игнорируется
    vote(a, 'o99');
    await pause(80);
    expect(st(a).voted).toHaveLength(0);
    vote(a, optionByText(a, 'lie B'));
    vote(b, optionByText(a, 'lie A'));
    await waitFor(() => st(a).voted.length === 2);
    expect(st(a).phase).toBe('round');
    vote(c, optionByText(a, TRUTH));
    await roundEnd(a);
    expect(scores(a, bots)).toEqual({ A: 1, B: 1, C: 2 });
  });

  it('подсказка: 1 раз, убирает чужой ложный вариант, hello возвращает you', async () => {
    const { a, bots } = await startGame(server, 'slow', 3);
    const b = bots[1] as Bot;
    send(a, M.MSG_HINT); // стадия write — игнор
    bots.forEach((x) => lie(x, `lie ${x.id}`));
    await stage(a, 'vote');
    const before = a.you.length;
    send(a, M.MSG_HINT);
    await waitFor(() => lastYou(a).hintId !== '');
    const hinted = lastYou(a).hintId;
    expect(hinted).not.toBe(optionByText(a, TRUTH));
    expect(hinted).not.toBe(lastYou(a).ownId);
    send(a, M.MSG_HINT);
    await pause(100);
    expect(a.you.length).toBe(before + 1);
    vote(a, hinted); // убранный — нельзя
    await pause(80);
    expect(st(a).voted).toHaveLength(0);
    expect(lastYou(b).hintId).toBe('');
    const n = b.you.length;
    send(b, M.MSG_HELLO);
    await waitFor(() => b.you.length === n + 1);
    expect(lastYou(b)).toEqual({ round: 1, lie: 'lie B', ownId: optionByText(a, 'lie B'), hintId: '' });
  });

  it('подсказка: общая выдумка всех не мешает (остаются выдумки игры)', async () => {
    const { a, bots } = await startGame(server, 'slow', 3);
    lie(bots[0] as Bot, 'only');
    lie(bots[1] as Bot, 'only');
    lie(bots[2] as Bot, 'only'); // все слиты в один вариант + 2 выдумки игры
    await stage(a, 'vote');
    const x = bots[0] as Bot;
    send(x, M.MSG_HINT); // свой общий вариант исключён, но 3 других остаются
    await waitFor(() => lastYou(x).hintId !== '');
    expect(x.toasts).toHaveLength(0);
  });

  it('settings: только хост, валидация', async () => {
    const [a, b] = (await join(server, 'fast', 3)) as [Bot, Bot, Bot];
    expect([[...st(a).packs], st(a).lang]).toEqual([['words', 'facts'], '']);
    send(b, M.MSG_SETTINGS, { packIds: ['laws'], rounds: 5, lang: 'en' });
    send(a, M.MSG_SETTINGS, { packIds: ['bogus'], rounds: 5, lang: 'en' });
    send(a, M.MSG_SETTINGS, { packIds: [], rounds: 5, lang: 'en' });
    send(a, M.MSG_SETTINGS, { packIds: ['laws'], rounds: 6, lang: 'en' });
    send(a, M.MSG_SETTINGS, { packIds: ['laws'], rounds: 5, lang: 'de' });
    send(a, M.MSG_SETTINGS, { packIds: 'laws', rounds: 5, lang: 'en' });
    await pause(100);
    expect([[...st(a).packs], st(a).lang]).toEqual([['words', 'facts'], '']);
    send(a, M.MSG_SETTINGS, { packIds: ['laws', 'records', 'laws'], rounds: 10, lang: 'kk' });
    await waitFor(() => st(a).rounds === 10);
    expect([[...st(a).packs], st(a).lang]).toEqual([['laws', 'records'], 'kk']);
    send(a, 'core:start');
    await waitFor(() => st(a).totalRounds === 10);
  });

  it('8 игроков: раунд до конца, 9-й получает full', async () => {
    const { a, bots } = await startGame(server, 'slow', 8);
    await expect(server.sdk.joinById(a.room.roomId, opts('I'))).rejects.toThrow();
    bots.forEach((x) => lie(x, `lie ${x.id}`));
    await stage(a, 'vote');
    expect(st(a).options).toHaveLength(9);
    bots.forEach((x) => vote(x, optionByText(a, TRUTH)));
    await roundEnd(a);
    expect(Object.values(scores(a, bots))).toEqual(Array(8).fill(2));
  });
});
