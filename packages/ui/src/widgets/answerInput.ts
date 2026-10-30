import { h } from '../dom.js';
import type { Component } from '../types.js';

export interface AnswerInputOptions {
  placeholder: string;
  submitLabel: string;
  maxLength: number;
  onSubmit(text: string): void;
  className?: string;
}

export interface AnswerInput extends Component {
  setValue(v: string): void;
  setDisabled(d: boolean): void;
  focus(): void;
}

/** Поле ввода ответа: input + счётчик n/max + кнопка; Enter отправляет. */
export function createAnswerInput(o: AnswerInputOptions): AnswerInput {
  const input = h('input', {
    type: 'text',
    class: 'p-answer__input',
    placeholder: o.placeholder,
    maxlength: o.maxLength,
    enterkeyhint: 'send',
    autocomplete: 'off',
  });
  const count = h('span', { class: 'p-answer__count' });
  const btn = h('button', { type: 'button', class: 'p-btn p-answer__btn' }, o.submitLabel);
  const el = h('div', { class: `p-answer${o.className ? ` ${o.className}` : ''}` }, [
    input,
    count,
    btn,
  ]);

  const updateCount = (): void => {
    count.textContent = `${Array.from(input.value).length}/${o.maxLength}`;
  };
  const submit = (): void => {
    if (input.disabled) return;
    const text = input.value.trim();
    if (text === '') return;
    o.onSubmit(text);
  };

  input.addEventListener('input', updateCount);
  input.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  btn.addEventListener('click', submit);
  updateCount();

  return {
    el,
    setValue(v) {
      input.value = v;
      updateCount();
    },
    setDisabled(d) {
      input.disabled = d;
      btn.disabled = d;
    },
    focus: () => input.focus(),
    destroy: () => el.remove(),
  };
}
