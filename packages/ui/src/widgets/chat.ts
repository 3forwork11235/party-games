import { h } from '../dom.js';
import type { Component, TFunction } from '../types.js';

export interface ChatMessage {
  nick: string;
  text: string;
}

export interface ChatProps {
  t: TFunction;
  onSend(text: string): void;
}

export interface Chat extends Component {
  addMessage(msg: ChatMessage): void;
}

const MAX_MESSAGES = 30;

export function createChat(props: ChatProps): Chat {
  const { t } = props;
  const log = h('div', { class: 'p-chat__log' });
  const input = h('input', {
    class: 'p-input',
    maxlength: 200,
    placeholder: t('ui.chat.placeholder'),
    autocomplete: 'off',
  });
  const form = h('form', { class: 'p-chat__form' }, [
    input,
    h('button', { class: 'p-btn', type: 'submit' }, t('ui.chat.send')),
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    props.onSend(text);
    input.value = '';
  });
  const body = h('div', {}, [log, form]);
  body.hidden = true;
  const toggle = h(
    'button',
    {
      class: 'p-btn',
      type: 'button',
      onClick: () => {
        body.hidden = !body.hidden;
      },
    },
    t('ui.chat.title'),
  );
  const el = h('div', { class: 'p-chat' }, [toggle, body]);

  function addMessage(msg: ChatMessage): void {
    log.append(h('div', {}, [h('strong', {}, `${msg.nick}: `), msg.text]));
    while (log.children.length > MAX_MESSAGES) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  }
  return { el, addMessage, destroy: () => el.remove() };
}
