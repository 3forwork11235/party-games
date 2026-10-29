import type { PartyClient } from '@party/core/client';
import { NICK_COLORS, type ICoreState } from '@party/core/shared';
import type { Tracker } from '@party/analytics';
import type { AdManager } from '@party/monetization';
import type { PlatformAdapter } from '@party/platform';
import type { ScreenRouter } from '../app.js';
import { createLobbyScreen } from '../screens/lobby.js';
import { createResultsScreen } from '../screens/results.js';
import { createWaitingScreen } from '../screens/waiting.js';
import type { TFunction } from '../types.js';
import { showToast } from '../widgets/toast.js';
import type { ChatDock } from './chatDock.js';
import { addLobbyExtras } from './extras.js';
import { createGameScreen } from './gameScreen.js';
import { createRoundEndScreen } from './roundEndScreen.js';
import { FRAME_COLORS } from './session.js';
import type { ShopFlow } from './shopFlow.js';
import type { StartPartyAppOptions } from './types.js';

export interface PhaseDeps<S extends ICoreState> {
  opts: StartPartyAppOptions<S>;
  client: PartyClient<S>;
  router: ScreenRouter;
  t: TFunction;
  platform: PlatformAdapter;
  tracker: Tracker;
  adManager: AdManager;
  me: string;
  onExit(): void;
  /** Необязательно: чат (лобби/результаты) и магазин (лобби). */
  chat?: ChatDock;
  shop?: ShopFlow;
}

export interface PhaseController<S extends ICoreState> {
  render(state: S): void;
  /** Сбросить внутренние флаги (выход на экран входа). */
  reset(): void;
}

type Key = 'lobby' | 'game' | 'roundEnd' | 'adBreak' | 'results';
const keyOf = (phase: ICoreState['phase']): Key =>
  phase === 'countdown' || phase === 'round' ? 'game' : phase;

/** Маршрутизация экранов по state.phase. Экран пересоздаётся только при смене группы фаз. */
export function createPhaseController<S extends ICoreState>(d: PhaseDeps<S>): PhaseController<S> {
  const { client, router, t, platform, tracker, adManager, me, opts } = d;
  let key: Key | null = null;
  let lastPhase: ICoreState['phase'] | null = null;
  let update: ((s: S) => void) | null = null;
  let inGame = false;
  let gameTracked = false;
  let gameStartedAt = 0;
  let roundStartedAt = 0;
  let adToken = 0;
  let resultsSig = '';

  const connected = (s: S): number => [...s.players.values()].filter((p) => p.connected).length;

  function leaveGame(): void {
    if (inGame) platform.gameplayStop();
    inGame = false;
  }

  function invite(code: string): void {
    void platform
      .share({ text: t('ui.entry.invited', { code }), url: platform.buildInviteUrl(code) })
      .then((ok) => {
        tracker.track('invite_sent', { game: opts.slug, channel: 'share' });
        if (ok && platform.id === 'web') showToast(t('ui.lobby.copied'), 'ok');
      });
  }

  function enterLobby(s: S): void {
    leaveGame();
    gameTracked = false;
    const lobby = createLobbyScreen({
      t,
      minPlayers: opts.gameConfig.minPlayers,
      nickColors: NICK_COLORS,
      frameColors: FRAME_COLORS,
      onInvite: () => invite(client.code ?? s.code),
      onReady: (ready) => client.send('core:ready', { ready }),
      onStart: () => client.send('core:start', {}),
      onKick: (playerId) => client.send('core:kick', { playerId }),
    });
    router.show(lobby);
    addLobbyExtras(lobby.el, { t, chat: d.chat, shop: d.shop, onLeave: d.onExit });
    update = (st) => lobby.update(st, me);
  }

  function enterGame(s: S): void {
    const screen = createGameScreen(t, { client, t, platform, me }, opts.mountGame);
    router.show(screen);
    update = (st) => screen.update(st);
    if (!inGame) platform.gameplayStart();
    inGame = true;
    if (s.round <= 1 && !gameTracked) {
      gameTracked = true;
      gameStartedAt = client.serverNow();
      tracker.track('game_start', { game: opts.slug, players: connected(s) });
    }
  }

  function enterRoundEnd(s: S): void {
    leaveGame();
    tracker.track('round_end', {
      game: opts.slug,
      round: s.round,
      durationMs: Math.max(0, client.serverNow() - roundStartedAt),
    });
    const screen = createRoundEndScreen(t);
    router.show(screen);
    update = (st) => screen.update(st);
  }

  function enterAdBreak(): void {
    leaveGame();
    router.show(createWaitingScreen({ t, textKey: 'ad.break_title' }));
    update = null;
    const mine = ++adToken;
    void adManager
      .onRoundBreak('round_break')
      .catch(() => 'error')
      .then(() => {
        if (mine === adToken && key === 'adBreak') client.send('core:adDone', {});
      });
  }

  function showResults(s: S): void {
    const list = [...s.players.values()];
    const isHost = s.hostId === me;
    const sig = `${isHost}|${list.map((p) => `${p.id}:${p.score}`).join(',')}`;
    if (sig === resultsSig) return;
    resultsSig = sig;
    const results = createResultsScreen({
      t,
      players: list,
      isHost,
      onAgain: () => client.send('core:restart', {}),
      onExit: d.onExit,
    });
    d.chat?.mount(results.el);
    router.show(results);
  }

  function enterResults(s: S): void {
    leaveGame();
    resultsSig = '';
    tracker.track('game_end', {
      game: opts.slug,
      rounds: s.totalRounds,
      players: connected(s),
      durationMs: Math.max(0, client.serverNow() - gameStartedAt),
    });
    update = showResults;
    showResults(s);
  }

  return {
    render(s) {
      const next = keyOf(s.phase);
      if (next !== key) {
        adToken++; // отменяет отложенный core:adDone прошлого перерыва
        key = next;
        if (next === 'lobby') enterLobby(s);
        else if (next === 'game') enterGame(s);
        else if (next === 'roundEnd') enterRoundEnd(s);
        else if (next === 'adBreak') enterAdBreak();
        else enterResults(s);
      }
      if (s.phase === 'round' && lastPhase !== 'round') roundStartedAt = client.serverNow();
      lastPhase = s.phase;
      update?.(s);
    },
    reset() {
      leaveGame();
      adToken++;
      key = null;
      lastPhase = null;
      update = null;
      gameTracked = false;
    },
  };
}
