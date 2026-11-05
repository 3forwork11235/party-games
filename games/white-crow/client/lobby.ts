import { clear, createPackPicker, h } from '@party/ui';
import type { GameContext, GameView } from '@party/ui/app-shell';
import { ownedPacks } from '../shared/catalog.js';
import { DEFAULT_ROUNDS, ROUND_OPTIONS, RULES, SLUG } from '../shared/config.js';
import { MSG_SETTINGS } from '../shared/messages.js';
import { PACKS } from '../shared/packs.js';
import type { CrowPublicState } from '../shared/types.js';
import { listOf, ruleEmoji } from './util.js';

/** Блок лобби: «Как играть», паки и число раундов (меняет хост). */
export function mountLobby(
  container: HTMLElement,
  ctx: GameContext<CrowPublicState>,
): GameView<CrowPublicState> {
  const { t, me } = ctx;
  let packs: string[] = [];
  let rounds: number = DEFAULT_ROUNDS;
  let isHost = false;

  const send = (): void => ctx.client.sendGame(MSG_SETTINGS, { packIds: packs, rounds });

  const how = h('div', { class: 'crow-how' }, [
    h('div', { class: 'crow-how__title' }, t('crow.howTo')),
    h(
      'div',
      { class: 'crow-how__cards' },
      RULES.map((r) =>
        h('div', { class: `crow-rulecard crow-rulecard--${r}` }, [
          h('span', { class: 'crow-rulecard__emoji' }, ruleEmoji(r)),
          h('div', { class: 'crow-rulecard__text' }, [
            h('div', { class: 'crow-rulecard__name' }, t(`crow.rule.${r}.name`)),
            h('div', { class: 'crow-rulecard__desc' }, t(`crow.rule.${r}.desc`)),
          ]),
        ]),
      ),
    ),
  ]);

  const picker = createPackPicker({
    t,
    title: t('crow.packs'),
    packs: PACKS,
    name: (id) => t(`crow.pack.${id}`),
    owned: () => ownedPacks(ctx.entitlements()),
    onChange: (ids) => {
      packs = ids;
      send();
    },
    onBuy: (rerender) => ctx.openShop(rerender),
    onSelect: (id, paid) => ctx.track('pack_selected', { game: SLUG, packId: id, paid }),
  });

  const roundsBody = h('div', { class: 'crow-rounds__body' });
  const roundsBox = h('div', { class: 'crow-rounds' }, [
    h('div', { class: 'crow-rounds__title' }, t('crow.rounds')),
    roundsBody,
  ]);
  const root = h('div', { class: 'crow-lobby' }, [how, picker.el, roundsBox]);
  container.append(root);

  function renderRounds(): void {
    clear(roundsBody);
    if (!isHost) {
      roundsBody.append(
        h('div', { class: 'crow-rounds__value' }, t('crow.roundsValue', { n: rounds })),
      );
      return;
    }
    const row = h('div', { class: 'crow-rounds__row' });
    for (const n of ROUND_OPTIONS) {
      row.append(
        h(
          'button',
          {
            type: 'button',
            class: `p-btn crow-rounds__opt${n === rounds ? ' crow-rounds__opt--on' : ''}`,
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
