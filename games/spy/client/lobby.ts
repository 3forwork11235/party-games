import { clear, createPackPicker, h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import { ownedPacks } from '@party/monetization';
import { DEFAULT_ROUNDS, ROUND_OPTIONS, SLUG } from '../shared/config.js';
import { MSG_SETTINGS } from '../shared/messages.js';
import { PACKS } from '../shared/packs.js';
import type { SpyPublicState } from '../shared/types.js';
import { listOf, type SpyCtx } from './util.js';

/** Блок лобби: паки локаций и число раундов (меняет хост, остальные видят значения). */
export function mountLobby(container: HTMLElement, ctx: SpyCtx): GameView<SpyPublicState> {
  const { t, me } = ctx;
  let packs: string[] = [];
  let rounds: number = DEFAULT_ROUNDS;
  let isHost = false;

  const send = (): void => ctx.client.sendGame(MSG_SETTINGS, { packIds: packs, rounds });

  const picker = createPackPicker({
    t,
    title: t('spy.packs'),
    packs: PACKS,
    name: (id) => t(`spy.pack.${id}`),
    owned: () => ownedPacks(ctx.entitlements(), SLUG, PACKS),
    onChange: (ids) => {
      packs = ids;
      send();
    },
    onBuy: (rerender) => ctx.openShop(rerender),
    onSelect: (id, paid) => ctx.track('pack_selected', { game: SLUG, packId: id, paid }),
  });

  const roundsBody = h('div', { class: 'spy-rounds__body' });
  const roundsBox = h('div', { class: 'spy-rounds' }, [
    h('div', { class: 'spy-rounds__title' }, t('spy.rounds')),
    roundsBody,
  ]);
  const root = h('div', { class: 'spy-lobby' }, [picker.el, roundsBox]);
  container.append(root);

  function renderRounds(): void {
    clear(roundsBody);
    if (!isHost) {
      roundsBody.append(
        h('div', { class: 'spy-rounds__value' }, t('spy.roundsValue', { n: rounds })),
      );
      return;
    }
    const row = h('div', { class: 'spy-rounds__row' });
    for (const n of ROUND_OPTIONS) {
      row.append(
        h(
          'button',
          {
            type: 'button',
            class: `p-btn spy-rounds__opt${n === rounds ? ' spy-rounds__opt--on' : ''}`,
            'aria-pressed': n === rounds ? 'true' : 'false',
            onClick: () => {
              if (n === rounds) return;
              rounds = n;
              send();
              renderRounds();
            },
          },
          String(n),
        ),
      );
    }
    roundsBody.append(row);
  }

  return {
    update(state) {
      isHost = state.hostId === me;
      packs = listOf(state.packs);
      rounds = state.rounds;
      picker.update(packs, isHost);
      renderRounds();
    },
    destroy() {
      picker.destroy();
      root.remove();
    },
  };
}
