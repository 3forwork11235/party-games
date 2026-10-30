import { createPackPicker } from '@party/ui';
import type { GameContext, GameView } from '@party/ui/app-shell';
import { SLUG } from '../shared/config.js';
import { ownedPacks } from '../shared/catalog.js';
import { MSG_PACKS } from '../shared/messages.js';
import { PACKS } from '../shared/packs.js';
import type { WhoOfUsPublicState } from '../shared/types.js';
import { resetSkipFlag } from './game.js';
import { listOf } from './util.js';

/** Блок паков в лобби: хост выбирает, остальные видят выбранное. */
export function mountLobby(
  container: HTMLElement,
  ctx: GameContext<WhoOfUsPublicState>,
): GameView<WhoOfUsPublicState> {
  const { t, me } = ctx;
  resetSkipFlag();
  const picker = createPackPicker({
    t,
    title: t('whoOfUs.packs'),
    packs: PACKS,
    name: (id) => t(`whoOfUs.pack.${id}`),
    owned: () => ownedPacks(ctx.entitlements()),
    onChange: (ids) => ctx.client.sendGame(MSG_PACKS, { packIds: ids }),
    onBuy: (rerender) => ctx.openShop(rerender),
    onSelect: (id, paid) => ctx.track('pack_selected', { game: SLUG, packId: id, paid }),
  });
  container.append(picker.el);

  return {
    update(state) {
      picker.update(listOf(state.packs), state.hostId === me);
    },
    destroy() {
      picker.destroy();
    },
  };
}
