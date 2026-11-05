import { isBotId, type ICoreState, type IPlayer } from '@party/core/shared';
import { clear, h } from '../dom.js';
import type { Component, TFunction } from '../types.js';

export interface LobbyProps {
  t: TFunction;
  minPlayers: number;
  maxPlayers?: number;
  /** Сколько ботов хост может добавить (нет/0 — кнопки нет). */
  maxBots?: number;
  /** id → css-цвет ника */
  nickColors?: Record<string, string>;
  /** id рамки → css-цвет рамки */
  frameColors?: Record<string, string>;
  onInvite(): void;
  onReady(ready: boolean): void;
  onStart(): void;
  onKick(playerId: string): void;
  onAddBot?(): void;
}

export type LobbyState = Pick<ICoreState, 'code' | 'hostId'> & {
  players: Iterable<[string, IPlayer]>;
};

export interface LobbyScreen extends Component {
  update(state: LobbyState, myId: string): void;
}

export function createLobbyScreen(props: LobbyProps): LobbyScreen {
  const { t } = props;
  const code = h('div', { class: 'p-code' });
  const list = h('div', { class: 'p-screen' });
  let myReady = false;
  const readyBtn = h('button', {
    class: 'p-btn',
    type: 'button',
    onClick: () => props.onReady(!myReady),
  });
  const startBtn = h(
    'button',
    { class: 'p-btn p-btn--primary', type: 'button', onClick: () => props.onStart() },
    t('ui.lobby.start'),
  );
  const inviteBtn = h(
    'button',
    { class: 'p-btn', type: 'button', onClick: () => props.onInvite() },
    t('ui.lobby.invite'),
  );

  const addBotBtn = h(
    'button',
    { class: 'p-btn', type: 'button', onClick: () => props.onAddBot?.() },
    t('ui.lobby.addBot'),
  );

  const el = h('div', { class: 'p-screen p-lobby' }, [
    h('div', { class: 'p-muted', style: 'text-align:center' }, t('ui.lobby.code')),
    code,
    inviteBtn,
    list,
    addBotBtn,
    readyBtn,
    startBtn,
  ]);

  function update(state: LobbyState, myId: string): void {
    code.textContent = state.code;
    const players = [...state.players].map(([, p]) => p);
    const isHost = state.hostId === myId;
    myReady = players.find((p) => p.id === myId)?.ready ?? false;
    readyBtn.textContent = myReady ? t('ui.lobby.notReady') : t('ui.lobby.ready');
    startBtn.hidden = !isHost;
    startBtn.disabled = players.filter((p) => p.connected).length < props.minPlayers;
    const botCount = players.filter((p) => isBotId(p.id)).length;
    const maxBots = props.maxBots ?? 0;
    addBotBtn.hidden = !isHost || maxBots <= 0;
    addBotBtn.disabled =
      botCount >= maxBots || (props.maxPlayers !== undefined && players.length >= props.maxPlayers);
    clear(list);
    for (const p of players) {
      const frame = props.frameColors?.[p.frame];
      const color = props.nickColors?.[p.nickColor];
      list.append(
        h(
          'div',
          {
            class: 'p-player' + (p.connected ? '' : ' p-player--offline'),
            style: frame ? `border-color:${frame}` : null,
          },
          [
            h('span', {}, p.avatar),
            h('span', { class: 'p-player__nick', style: color ? `color:${color}` : null }, p.nick),
            p.id === state.hostId ? h('span', { title: t('ui.lobby.host') }, '👑') : null,
            !p.connected
              ? h('span', { class: 'p-muted' }, t('ui.lobby.offline'))
              : p.ready
                ? h('span', { class: 'p-ready' }, t('ui.lobby.readyMark'))
                : null,
            isHost && p.id !== myId
              ? h(
                  'button',
                  {
                    class: 'p-btn',
                    type: 'button',
                    'aria-label': t('ui.lobby.kick'),
                    onClick: () => props.onKick(p.id),
                  },
                  '✕',
                )
              : null,
          ],
        ),
      );
    }
  }
  return { el, update, destroy: () => el.remove() };
}
