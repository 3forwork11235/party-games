import { createAnswerInput, h } from '@party/ui';
import { LIE_MAX } from '../shared/config.js';
import { MSG_LIE, type YouMessage } from '../shared/messages.js';
import type { BluffPublicState } from '../shared/types.js';
import {
  connectedIds,
  fontClass,
  listOf,
  questionNodes,
  type BluffCtx,
} from './util.js';

export interface Panel {
  el: HTMLElement;
  update(state: BluffPublicState, you: YouMessage | null): void;
  destroy(): void;
}

/** Карточка вопроса: номер, категория и текст с подсвеченным пропуском. */
export function createQuestionCard(ctx: BluffCtx): {
  el: HTMLElement;
  update(state: BluffPublicState): void;
} {
  const { t } = ctx;
  const head = h('div', { class: 'bluff-qhead' });
  const text = h('div', { class: 'bluff-qtext' });
  const el = h('div', { class: 'bluff-qcard' }, [head, text]);
  let sig = '';
  return {
    el,
    update(state) {
      const next = `${state.round}|${state.totalRounds}|${state.category}|${state.question}`;
      if (next === sig) return;
      sig = next;
      head.textContent = `${t('bluff.round', { n: state.round, total: state.totalRounds })} · ${
        state.category ? t(`bluff.pack.${state.category}`) : ''
      }`;
      text.replaceChildren(...questionNodes(state.question));
    },
  };
}

/** Стадия write: поле выдумки, после отправки — «Твоя выдумка» и «Изменить». */
export function createWritePanel(ctx: BluffCtx): Panel {
  const { t } = ctx;
  const card = createQuestionCard(ctx);
  const input = createAnswerInput({
    placeholder: t('bluff.write.placeholder'),
    submitLabel: t('bluff.write.send'),
    maxLength: LIE_MAX,
    className: 'bluff-input',
    onSubmit: (text) => ctx.client.sendGame(MSG_LIE, { text }),
  });
  const hint = h('div', { class: 'bluff-hint' }, t('bluff.write.hint'));
  const form = h('div', { class: 'bluff-form' }, [hint, input.el]);

  const lieText = h('div', { class: 'bluff-mylie__text' });
  const editBtn = h(
    'button',
    {
      type: 'button',
      class: 'p-btn bluff-mylie__edit',
      onClick: () => {
        editing = true;
        input.setValue(lastLie);
        render();
        input.focus();
      },
    },
    `✏️ ${t('bluff.write.edit')}`,
  );
  const mine = h('div', { class: 'bluff-mylie' }, [
    h('div', { class: 'bluff-mylie__label' }, t('bluff.write.yours')),
    lieText,
    editBtn,
  ]);
  const ready = h('div', { class: 'bluff-ready' });
  const el = h('div', { class: 'bluff-write' }, [card.el, form, mine, ready]);

  let editing = false;
  let lastLie = '';
  let round = -1;
  let lastYou: YouMessage | null = null;
  let last: { state: BluffPublicState; you: YouMessage | null } | null = null;

  function render(): void {
    if (!last) return;
    const { state, you } = last;
    const lie = you?.lie ?? '';
    const showForm = lie === '' || editing;
    form.hidden = !showForm;
    mine.hidden = showForm;
    lieText.textContent = lie;
    lieText.className = `bluff-mylie__text${fontClass(ctx.cosmetics().skin)}`;
    const connected = connectedIds(state);
    const done = listOf(state.submitted).filter((id) => connected.has(id)).length;
    ready.textContent = t('bluff.write.ready', { done, total: connected.size });
  }

  return {
    el,
    update(state, you) {
      if (state.round !== round) {
        round = state.round;
        editing = false;
        lastLie = '';
        input.setValue('');
      }
      // Пришло новое `you` (выдумку приняли) — возвращаемся к карточке «Твоя выдумка».
      if (you !== lastYou && you?.lie) editing = false;
      lastYou = you;
      lastLie = you?.lie ?? '';
      last = { state, you };
      card.update(state);
      render();
    },
    destroy() {
      input.destroy();
      el.remove();
    },
  };
}
