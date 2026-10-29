// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IPlayer } from '@party/core/shared';
import { createLobbyScreen, createScoreboard, createScreenRouter } from '../src/index.js';

const t = (k: string): string => k;
const mk = (id: string, score: number, extra: Partial<IPlayer> = {}): IPlayer => ({
  id,
  sessionId: id,
  nick: id,
  avatar: 'A',
  frame: '',
  nickColor: '',
  score,
  roundScore: 0,
  connected: true,
  ready: false,
  ...extra,
});

describe('router', () => {
  it('destroys previous component', () => {
    const root = document.createElement('div');
    const router = createScreenRouter(root);
    const a = { el: document.createElement('div'), destroy: vi.fn() };
    const b = { el: document.createElement('div'), destroy: vi.fn() };
    router.show(a);
    router.show(b);
    expect(a.destroy).toHaveBeenCalledOnce();
    expect(root.firstChild).toBe(b.el);
  });
});

describe('lobby', () => {
  const players = new Map([
    ['a', mk('a', 0)],
    ['b', mk('b', 0)],
  ]);
  const state = { code: 'ABCDE', hostId: 'a', players };
  const noop = (): void => undefined;
  const props = { t, minPlayers: 2, onInvite: noop, onReady: noop, onStart: noop, onKick: noop };
  const findStart = (el: HTMLElement): HTMLButtonElement | undefined =>
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'ui.lobby.start');

  it('shows start only to host', () => {
    const l = createLobbyScreen(props);
    l.update(state, 'a');
    expect(findStart(l.el)?.hidden).toBe(false);
    l.update(state, 'b');
    expect(findStart(l.el)?.hidden).toBe(true);
  });
  it('disables start below minPlayers', () => {
    const l = createLobbyScreen({ ...props, minPlayers: 3 });
    l.update(state, 'a');
    expect(findStart(l.el)?.disabled).toBe(true);
  });
});

describe('scoreboard', () => {
  it('sorts by score', () => {
    const s = createScoreboard();
    s.update([mk('low', 1), mk('high', 9, { roundScore: 3 })]);
    const rows = [...s.el.querySelectorAll('.p-score-row__nick')].map((e) => e.textContent);
    expect(rows).toEqual(['high', 'low']);
    expect(s.el.textContent).toContain('+3');
  });
});
