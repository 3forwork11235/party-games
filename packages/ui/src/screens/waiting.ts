import { h } from '../dom.js';
import type { Component, TFunction } from '../types.js';

export interface WaitingProps {
  t: TFunction;
  /** i18n-ключ, по умолчанию 'ui.waiting.default' */
  textKey?: string;
}

export interface WaitingScreen extends Component {
  update(textKey: string): void;
}

export function createWaitingScreen(props: WaitingProps): WaitingScreen {
  const text = h(
    'div',
    { class: 'p-muted', style: 'text-align:center' },
    props.t(props.textKey ?? 'ui.waiting.default'),
  );
  const el = h('div', { class: 'p-screen p-waiting', style: 'justify-content:center' }, [
    h('div', { class: 'p-spinner', role: 'status' }),
    text,
  ]);
  return {
    el,
    update: (key) => {
      text.textContent = props.t(key);
    },
    destroy: () => el.remove(),
  };
}
