import { clear, h } from '@party/ui';
import { HINT_PLACEMENT } from '../shared/catalog.js';
import { MSG_HINT, MSG_VOTE, type YouMessage } from '../shared/messages.js';
import type { BluffPublicState } from '../shared/types.js';
import { connectedIds, fontClass, listOf, type BluffCtx } from './util.js';
import { createQuestionCard, type Panel } from './write.js';

/** Стадия vote: варианты кнопками шрифтом скина, подсказка за рекламу. */
export function createVotePanel(ctx: BluffCtx, onChange: () => void): Panel {
  const { t } = ctx;
  const card = createQuestionCard(ctx);
  const list = h('div', { class: 'bluff-options' });
  const hintBtn = h(
    'button',
    {
      type: 'button',
      class: 'p-btn bluff-hintbtn',
      onClick: () => void useHint(),
    },
    `📺 ${t('bluff.vote.hint')}`,
  );
  const voted = h('div', { class: 'bluff-ready' });
  const el = h('div', { class: 'bluff-vote' }, [
    card.el,
    h('div', { class: 'bluff-hint' }, t('bluff.vote.pick')),
    list,
    hintBtn,
    voted,
  ]);

  let round = -1;
  let picked = '';
  let hintAsked = false;
  let busy = false;
  let last: { state: BluffPublicState; you: YouMessage | null } | null = null;
  let sig = '';

  async function useHint(): Promise<void> {
    if (busy || hintAsked) return;
    busy = true;
    hintBtn.disabled = true;
    try {
      const ok = await ctx.ads.showRewarded(HINT_PLACEMENT);
      if (ok) {
        hintAsked = true;
        ctx.client.sendGame(MSG_HINT, {});
      }
    } finally {
      busy = false;
      onChange();
    }
  }

  function render(): void {
    if (!last) return;
    const { state, you } = last;
    const ownId = you?.ownId ?? '';
    const hintId = you?.hintId ?? '';
    const font = fontClass(ctx.cosmetics().skin);
    const next = [
      state.options.map((o) => `${o.id}:${o.text}`).join('|'),
      ownId,
      hintId,
      picked,
      font,
    ].join('#');
    if (next !== sig) {
      sig = next;
      clear(list);
      for (const o of state.options) {
        const own = o.id === ownId;
        const removed = o.id === hintId;
        const cls = [
          'bluff-opt-btn',
          font,
          o.id === picked ? 'bluff-opt-btn--picked' : '',
          own ? 'bluff-opt-btn--own' : '',
          removed ? 'bluff-opt-btn--removed' : '',
        ]
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        list.append(
          h(
            'button',
            {
              type: 'button',
              class: cls,
              disabled: own || removed,
              'aria-pressed': o.id === picked ? 'true' : 'false',
              onClick: () => {
                picked = o.id;
                ctx.client.sendGame(MSG_VOTE, { optionId: o.id });
                render();
              },
            },
            [
              h('span', { class: 'bluff-opt-btn__text' }, o.text),
              own ? h('span', { class: 'bluff-opt-btn__tag' }, t('bluff.vote.own')) : null,
            ],
          ),
        );
      }
    }
    hintBtn.hidden = !(ctx.ads.canShowRewarded() && hintId === '' && !hintAsked);
    hintBtn.disabled = busy;
    const connected = connectedIds(state);
    const done = listOf(state.voted).filter((id) => connected.has(id)).length;
    voted.textContent = t('bluff.vote.ready', { done, total: connected.size });
  }

  return {
    el,
    update(state, you) {
      if (state.round !== round) {
        round = state.round;
        picked = '';
        hintAsked = false;
        sig = '';
      }
      last = { state, you };
      card.update(state);
      render();
    },
    destroy() {
      el.remove();
    },
  };
}
