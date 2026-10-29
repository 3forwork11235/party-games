import type { IPlayer } from '@party/core/shared';
import { clear, h } from '../dom.js';
import type { Component } from '../types.js';

export interface ScoreboardProps {
  nickColors?: Record<string, string>;
}

export interface Scoreboard extends Component {
  update(players: IPlayer[]): void;
}

export function createScoreboard(props: ScoreboardProps = {}): Scoreboard {
  const el = h('div', { class: 'p-scoreboard' });
  function update(players: IPlayer[]): void {
    clear(el);
    for (const p of [...players].sort((a, b) => b.score - a.score)) {
      const color = props.nickColors?.[p.nickColor];
      el.append(
        h('div', { class: 'p-score-row' }, [
          h('span', {}, p.avatar),
          h('span', { class: 'p-score-row__nick', style: color ? `color:${color}` : null }, p.nick),
          p.roundScore > 0 ? h('span', { class: 'p-plus' }, `+${p.roundScore}`) : null,
          h('strong', {}, String(p.score)),
        ]),
      );
    }
  }
  return { el, update, destroy: () => el.remove() };
}
