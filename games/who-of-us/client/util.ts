import { h } from '@party/ui';
import { FRAME_COLORS } from '@party/ui/app-shell';
import type { IPlayer } from '@party/core/shared';
import type { WhoOfUsPublicState } from '../shared/types.js';

/** Счётчики из MapSchema (или plain-объекта в тестах) → Map. */
export function readCounts(src: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!src || typeof src !== 'object') return out;
  const forEach = (src as { forEach?: unknown }).forEach;
  if (typeof forEach === 'function') {
    (src as { forEach(cb: (v: unknown, k: unknown) => void): void }).forEach((v, k) => {
      if (typeof v === 'number') out.set(String(k), v);
    });
    return out;
  }
  for (const [k, v] of Object.entries(src)) if (typeof v === 'number') out.set(k, v);
  return out;
}

export function listOf(src: readonly string[] | undefined): string[] {
  return src ? [...src] : [];
}

export function playersOf(state: WhoOfUsPublicState): IPlayer[] {
  return [...state.players.values()];
}

/** Аватар-эмодзи в цветной рамке. */
export function avatarEl(p: IPlayer): HTMLElement {
  const color = FRAME_COLORS[p.frame] ?? 'transparent';
  const el = h('span', { class: 'wou-avatar' }, p.avatar);
  el.style.borderColor = color;
  if (p.frame !== 'none' && color !== 'transparent') el.classList.add('wou-avatar--framed');
  return el;
}

/** Первый сегмент questionId — id пака. */
export function packOf(questionId: string): string {
  return questionId.split('/')[0] ?? '';
}
