import { getLanguage } from '@party/i18n';
import { ownedPacks } from '@party/monetization';
import { clear, createPackPicker, h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import { DEFAULT_ROUNDS, LANGS, ROUND_OPTIONS, SLUG } from '../shared/config.js';
import { MSG_SETTINGS } from '../shared/messages.js';
import { DEFAULT_PACKS, PACKS } from '../shared/packs.js';
import type { BluffPublicState } from '../shared/types.js';
import { listOf, type BluffCtx } from './util.js';

/** Блок лобби: паки, число вопросов и язык вопросов (меняет хост, остальные видят значения). */
export function mountLobby(container: HTMLElement, ctx: BluffCtx): GameView<BluffPublicState> {
  const { t, me } = ctx;
  let packs: string[] = [];
  let rounds: number = DEFAULT_ROUNDS;
  let lang = '';
  let isHost = false;
  let langSent = false;

  const send = (): void =>
    ctx.client.sendGame(MSG_SETTINGS, {
      packIds: packs.length > 0 ? packs : [...DEFAULT_PACKS],
      rounds,
      lang: lang || getLanguage(),
    });

  const picker = createPackPicker({
    t,
    title: t('bluff.packs'),
    packs: PACKS,
    name: (id) => t(`bluff.pack.${id}`),
    owned: () => ownedPacks(ctx.entitlements(), SLUG, PACKS),
    onChange: (ids) => {
      packs = ids;
      send();
    },
    onBuy: (rerender) => ctx.openShop(rerender),
    onSelect: (id, paid) => ctx.track('pack_selected', { game: SLUG, packId: id, paid }),
  });

  const roundsBody = h('div', { class: 'bluff-opt__body' });
  const langBody = h('div', { class: 'bluff-opt__body' });
  const root = h('div', { class: 'bluff-lobby' }, [
    picker.el,
    h('div', { class: 'bluff-opt' }, [
      h('div', { class: 'bluff-opt__title' }, t('bluff.rounds')),
      roundsBody,
    ]),
    h('div', { class: 'bluff-opt' }, [
      h('div', { class: 'bluff-opt__title' }, t('bluff.lang')),
      langBody,
    ]),
  ]);
  container.append(root);

  function renderChoice<T extends string | number>(
    body: HTMLElement,
    values: readonly T[],
    current: T,
    label: (v: T) => string,
    pick: (v: T) => void,
  ): void {
    clear(body);
    if (!isHost) {
      body.append(h('div', { class: 'bluff-opt__value' }, label(current)));
      return;
    }
    const row = h('div', { class: 'bluff-opt__row' });
    for (const v of values) {
      row.append(
        h(
          'button',
          {
            type: 'button',
            class: `p-btn bluff-opt__btn${v === current ? ' bluff-opt__btn--on' : ''}`,
            'aria-pressed': v === current ? 'true' : 'false',
            onClick: () => {
              if (v !== current) pick(v);
            },
          },
          label(v),
        ),
      );
    }
    body.append(row);
  }

  function renderOptions(): void {
    renderChoice(
      roundsBody,
      ROUND_OPTIONS,
      rounds as (typeof ROUND_OPTIONS)[number],
      (n) => (isHost ? String(n) : t('bluff.roundsValue', { n })),
      (n) => {
        rounds = n;
        send();
        renderOptions();
      },
    );
    renderChoice(
      langBody,
      LANGS,
      (lang || getLanguage()) as (typeof LANGS)[number],
      (l) => t(`bluff.langs.${l}`),
      (l) => {
        lang = l;
        send();
        renderOptions();
      },
    );
  }

  return {
    update(state) {
      isHost = state.hostId === me;
      packs = listOf(state.packs);
      rounds = state.rounds;
      lang = state.lang;
      picker.update(packs, isHost);
      renderOptions();
      // Язык по умолчанию — язык интерфейса хоста (пока сервер его не знает).
      if (isHost && state.lang === '' && !langSent) {
        langSent = true;
        send();
      }
      if (state.lang !== '') langSent = false;
    },
    destroy() {
      picker.destroy();
      root.remove();
    },
  };
}
