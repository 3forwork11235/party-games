import { h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import { BALL_SPECS } from '../shared/table.js';
import type { BallKind, EliteBilliardsPublicState } from '../shared/types.js';
import { ballColor } from './render/balls.js';
import type { BilliardsCtx } from './types.js';

const KINDS: ReadonlyArray<{ kind: BallKind; id: number }> = [
  { kind: 'small', id: 1 },
  { kind: 'std', id: 4 },
  { kind: 'big', id: 7 },
  { kind: 'giant', id: 9 },
  { kind: 'gold', id: 10 },
];

/** Блок лобби: краткие правила и таблица номиналов шаров. */
export function mountLobby(
  container: HTMLElement,
  ctx: BilliardsCtx,
): GameView<EliteBilliardsPublicState> {
  const { t, me } = ctx;
  const rules = h(
    'ul',
    { class: 'eb-lobby__rules' },
    [1, 2, 3, 4].map((n) => h('li', {}, t(`billiards.lobby.rule${n}`))),
  );
  const values = h(
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
  const botsHint = h('div', { class: 'eb-lobby__hint' }, t('billiards.lobby.botsHint'));
  botsHint.hidden = true;
  const el = h('div', { class: 'eb-lobby' }, [
    h('div', { class: 'eb-lobby__title' }, t('billiards.lobby.title')),
    rules,
    h('div', { class: 'eb-lobby__title' }, t('billiards.lobby.values')),
    values,
    botsHint,
  ]);
  container.append(el);
  return {
    update(state) {
      botsHint.hidden = state.hostId !== me;
    },
    destroy() {
      el.remove();
    },
  };
}
