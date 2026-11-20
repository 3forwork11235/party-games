import { h } from '@party/ui';
import { BALL_SPECS } from '../shared/table.js';
import type { BallKind } from '../shared/types.js';
import { ballColor } from './render/balls.js';

export const KINDS: ReadonlyArray<{ kind: BallKind; id: number }> = [
  { kind: 'small', id: 1 },
  { kind: 'std', id: 4 },
  { kind: 'big', id: 7 },
  { kind: 'giant', id: 9 },
  { kind: 'gold', id: 10 },
];

/** Краткие правила (список). */
export function rulesList(t: (key: string) => string): HTMLElement {
  return h(
    'ul',
    { class: 'eb-lobby__rules' },
    [1, 2, 3, 4].map((n) => h('li', {}, t(`billiards.lobby.rule${n}`))),
  );
}

/** Таблица номиналов шаров. */
export function valuesBlock(t: (key: string) => string): HTMLElement {
  return h(
    'div',
    { class: 'eb-lobby__values' },
    KINDS.map(({ kind, id }) => {
      const spec = BALL_SPECS[kind];
      const px = Math.round(spec.r * 1500);
      const ball = h(
        'span',
        {
          class: 'eb-ball-icon',
          style: `width:${px}px;height:${px}px;background:${ballColor(id, kind)}`,
        },
        String(spec.value),
      );
      return h('div', { class: 'eb-lobby__value' }, [
        ball,
        h('span', {}, t(`billiards.kind.${kind}`)),
      ]);
    }),
  );
}
