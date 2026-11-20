import { h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import type { EliteBilliardsPublicState } from '../shared/types.js';
import { createHotseat } from './hotseat.js';
import { rulesList, valuesBlock } from './rulesBlock.js';
import type { BilliardsCtx } from './types.js';

/** Блок лобби: краткие правила и таблица номиналов шаров. */
export function mountLobby(
  container: HTMLElement,
  ctx: BilliardsCtx,
): GameView<EliteBilliardsPublicState> {
  const { t, me } = ctx;
  const rules = rulesList(t);
  const values = valuesBlock(t);
  const botsHint = h('div', { class: 'eb-lobby__hint' }, t('billiards.lobby.botsHint'));
  botsHint.hidden = true;
  const hotseat = createHotseat(ctx);
  const el = h('div', { class: 'eb-lobby' }, [
    hotseat.el,
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
      hotseat.update(state);
    },
    destroy() {
      el.remove();
    },
  };
}
