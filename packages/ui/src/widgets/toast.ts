import { h } from '../dom.js';

export type ToastKind = 'info' | 'ok' | 'error';

let host: HTMLElement | null = null;

/** Показывает всплывающее уведомление (текст уже переведён вызывающим). */
export function showToast(text: string, kind: ToastKind = 'info', durationMs = 2500): void {
  if (!host || !host.isConnected) {
    host = h('div', { class: 'p-toasts', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const node = h('div', { class: `p-toast p-toast--${kind}` }, text);
  host.append(node);
  setTimeout(() => node.remove(), durationMs);
}
