import { h } from '@party/ui';

export const HANDOFF_MS = 1500;

export interface Handoff {
  el: HTMLElement;
  show(text: string): void;
  hide(): void;
  destroy(): void;
}

/** Крупная плашка «Ход: <ник>. Передай устройство» (hot-seat), исчезает через HANDOFF_MS. */
export function createHandoff(): Handoff {
  const el = h('div', { class: 'eb-handoff', hidden: true });
  let timer = 0;
  const hide = (): void => {
    clearTimeout(timer);
    el.hidden = true;
  };
  return {
    el,
    show(text) {
      clearTimeout(timer);
      el.textContent = text;
      el.hidden = false;
      timer = window.setTimeout(hide, HANDOFF_MS);
    },
    hide,
    destroy() {
      hide();
      el.remove();
    },
  };
}
