// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { PartyClient } from '@party/core/client';
import type { CorePhase, ICoreState, IPlayer } from '@party/core/shared';
import type { PlatformAdapter } from '@party/platform';
import type { AdManager } from '@party/monetization';
import { createScreenRouter } from '../src/app.js';
import { createPhaseController } from '../src/app-shell/phases.js';

const player = (id: string, score = 0): IPlayer => ({
  id,
  sessionId: id,
  nick: id,
  avatar: 'A',
  frame: 'none',
  nickColor: 'default',
  score,
  roundScore: 0,
  connected: true,
  ready: false,
});

function makeState(phase: CorePhase, round = 1): ICoreState {
  return {
    code: 'ABCDE',
    phase,
    phaseEndsAt: 0,
    round,
    totalRounds: 3,
    hostId: 'a',
    players: new Map([
      ['a', player('a')],
      ['b', player('b')],
    ]),
  };
}

function setup(adDelay = 0) {
  const sent: string[] = [];
  const client = {
    code: 'ABCDE',
    send: (type: string) => void sent.push(type),
    serverNow: () => 1000,
  } as unknown as PartyClient<ICoreState>;
  const platform = {
    id: 'web',
    gameplayStart: vi.fn(),
    gameplayStop: vi.fn(),
    share: vi.fn(async () => true),
    buildInviteUrl: (c: string) => `x?room=${c}`,
  } as unknown as PlatformAdapter;
  const events: string[] = [];
  const tracker = { track: (n: string) => void events.push(n), startSession: () => {} };
  const adManager: AdManager = {
    onRoundBreak: () => new Promise((r) => setTimeout(() => r('skipped'), adDelay)),
    showRewarded: async () => false,
    canShowRewarded: () => false,
  };
  const mount = vi.fn((box: HTMLElement) => {
    box.append('GAME');
    return { update: vi.fn(), destroy: vi.fn() };
  });
  const root = document.createElement('div');
  const router = createScreenRouter(root);
  const phases = createPhaseController({
    opts: {
      slug: 'x',
      gameConfig: { slug: 'x', minPlayers: 2 } as never,
      messages: {},
      mountGame: mount,
    },
    client,
    router,
    t: (k) => k,
    platform,
    tracker: tracker as never,
    adManager,
    me: 'a',
    onExit: () => {},
  });
  return { sent, events, root, phases, mount, platform };
}

describe('app-shell phase controller', () => {
  it('walks lobby → game → roundEnd → adBreak → results and sends adDone', async () => {
    const { sent, events, root, phases, mount, platform } = setup();
    phases.render(makeState('lobby'));
    expect(root.querySelector('.p-lobby')).not.toBeNull();

    phases.render(makeState('countdown'));
    phases.render(makeState('round'));
    expect(mount).toHaveBeenCalledTimes(1); // countdown → round не пересоздаёт игру
    expect(root.textContent).toContain('GAME');
    expect(platform.gameplayStart).toHaveBeenCalledTimes(1);

    phases.render(makeState('roundEnd'));
    expect(platform.gameplayStop).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.p-scoreboard')).not.toBeNull();

    phases.render(makeState('adBreak'));
    await new Promise((r) => setTimeout(r, 5));
    expect(sent).toContain('core:adDone');

    phases.render(makeState('results', 3));
    expect(root.querySelector('.p-results')).not.toBeNull();
    expect(events).toEqual(['game_start', 'round_end', 'game_end']);
  });

  it('does not send adDone if the phase already changed', async () => {
    const { sent, phases } = setup(10);
    phases.render(makeState('adBreak'));
    phases.render(makeState('countdown'));
    await new Promise((r) => setTimeout(r, 25));
    expect(sent).not.toContain('core:adDone');
  });
});
