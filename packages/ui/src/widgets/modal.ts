import { h } from '../dom.js';
import type { Component } from '../types.js';

export interface ModalProps {
  title?: string;
  content: Node | string;
  /** Кнопки (текст уже переведён). */
  actions?: { label: string; kind?: 'primary' | 'danger'; onClick(): void }[];
  onClose?(): void;
}

export interface Modal extends Component {
  close(): void;
}

/** Модальное окно; добавляется в document.body. */
export function openModal(props: ModalProps): Modal {
  const close = (): void => {
    el.remove();
    props.onClose?.();
  };
  const actions = (props.actions ?? []).map((a) =>
    h(
      'button',
      { class: 'p-btn' + (a.kind ? ` p-btn--${a.kind}` : ''), type: 'button', onClick: () => a.onClick() },
      a.label,
    ),
  );
  const box = h('div', { class: 'p-card p-modal__box', role: 'dialog' }, [
    props.title ? h('h2', { class: 'p-title' }, props.title) : null,
    typeof props.content === 'string' ? h('div', {}, props.content) : props.content,
    h('div', { class: 'p-modal__actions' }, actions),
  ]);
  const el = h('div', { class: 'p-modal' }, box);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  document.body.append(el);
  return { el, close, destroy: () => el.remove() };
}
