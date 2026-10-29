import type { IPlayer } from '@party/core/shared';
import { h } from '../dom.js';
import type { Component, TFunction } from '../types.js';

export interface ResultsProps {
  t: TFunction;
  players: IPlayer[];
  isHost: boolean;
  onAgain(): void;
  onExit(): void;
}

export function createResultsScreen(props: ResultsProps): Component {
  const { t } = props;
  const sorted = [...props.players].sort((a, b) => b.score - a.score);
  const place = (p: IPlayer | undefined, n: number): HTMLElement | null =>
    p
      ? h('div', { class: `p-podium__place p-podium__place--${n}` }, [
          h('div', { style: 'font-size:2rem' }, p.avatar),
          h('div', { class: 'p-player__nick' }, p.nick),
          h('strong', {}, String(p.score)),
          h('div', {}, String(n)),
        ])
      : null;
  const rest = sorted
    .slice(3)
    .map((p, i) =>
      h('div', { class: 'p-player' }, [
        h('span', {}, String(i + 4)),
        h('span', {}, p.avatar),
        h('span', { class: 'p-player__nick' }, p.nick),
        h('strong', {}, String(p.score)),
      ]),
    );
  const el = h('div', { class: 'p-screen p-results' }, [
    h('h1', { class: 'p-title' }, t('ui.results.title')),
    h('div', { class: 'p-podium' }, [place(sorted[1], 2), place(sorted[0], 1), place(sorted[2], 3)]),
    ...rest,
    props.isHost
      ? h(
          'button',
          { class: 'p-btn p-btn--primary', type: 'button', onClick: () => props.onAgain() },
          t('ui.results.again'),
        )
      : h('div', { class: 'p-muted', style: 'text-align:center' }, t('ui.results.waitHost')),
    h('button', { class: 'p-btn', type: 'button', onClick: () => props.onExit() }, t('ui.results.exit')),
  ]);
  return { el, destroy: () => el.remove() };
}
