import { NICK_COLORS, type IPlayer } from '@party/core/shared';
import { h } from '@party/ui';
import { FRAME_COLORS, type GameContext } from '@party/ui/app-shell';
import type { BluffPublicState } from '../shared/types.js';

export type BluffCtx = GameContext<BluffPublicState>;

/** Список из ArraySchema (или plain-массива в тестах) → обычный массив. */
export function listOf<T>(src: readonly T[] | undefined): T[] {
  return src ? [...src] : [];
}

/** Строковая MapSchema (или plain-объект) → Map. */
export function readMap(src: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!src || typeof src !== 'object') return out;
  const forEach = (src as { forEach?: unknown }).forEach;
  if (typeof forEach === 'function') {
    (src as { forEach(cb: (v: unknown, k: unknown) => void): void }).forEach((v, k) => {
      if (typeof v === 'string') out.set(String(k), v);
    });
    return out;
  }
  for (const [k, v] of Object.entries(src)) if (typeof v === 'string') out.set(k, v);
  return out;
}

export function playersOf(state: BluffPublicState): IPlayer[] {
  return [...state.players.values()];
}

export function connectedIds(state: BluffPublicState): Set<string> {
  return new Set(
    playersOf(state)
      .filter((p) => p.connected)
      .map((p) => p.id),
  );
}

export function nickOf(state: BluffPublicState, id: string): string {
  return state.players.get(id)?.nick ?? '';
}

/** Аватар-эмодзи в цветной рамке. */
export function avatarEl(p: IPlayer): HTMLElement {
  const color = FRAME_COLORS[p.frame] ?? 'transparent';
  const el = h('span', { class: 'bluff-avatar', title: p.nick }, p.avatar);
  el.style.borderColor = color;
  if (p.frame !== 'none' && color !== 'transparent') el.classList.add('bluff-avatar--framed');
  return el;
}

/** Ник с цветом из косметики (градиенты — через background-clip). */
export function nickEl(p: IPlayer, cls = 'bluff-nick'): HTMLElement {
  const el = h('span', { class: cls }, p.nick);
  const color = p.nickColor && p.nickColor !== 'default' ? NICK_COLORS[p.nickColor] : undefined;
  if (color?.includes('gradient')) {
    el.style.background = color;
    el.style.setProperty('-webkit-background-clip', 'text');
    el.style.backgroundClip = 'text';
    el.style.color = 'transparent';
  } else if (color) {
    el.style.color = color;
  }
  return el;
}

/** Класс шрифта по скину текущего игрока ('' — без особого шрифта). */
export function fontClass(skin: string | undefined): string {
  return skin && /^font_[a-z]+$/.test(skin) ? ` bluff-font--${skin}` : '';
}

/** Текст вопроса с подсвеченным пропуском `___`. */
export function questionNodes(text: string): (Node | string)[] {
  const parts = text.split('___');
  const out: (Node | string)[] = [];
  parts.forEach((part, i) => {
    if (i > 0) out.push(h('span', { class: 'bluff-gap' }, '___'));
    if (part) out.push(part);
  });
  return out;
}
