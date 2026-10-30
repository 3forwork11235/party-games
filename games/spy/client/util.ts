import { NICK_COLORS, type IPlayer } from '@party/core/shared';
import { h } from '@party/ui';
import { FRAME_COLORS, type GameContext } from '@party/ui/app-shell';
import type { SpyPublicState } from '../shared/types.js';

export type SpyCtx = GameContext<SpyPublicState>;

/** Список из ArraySchema (или plain-массива в тестах) → обычный массив. */
export function listOf(src: readonly string[] | undefined): string[] {
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

export function playersOf(state: SpyPublicState): IPlayer[] {
  return [...state.players.values()];
}

export function connectedIds(state: SpyPublicState): Set<string> {
  return new Set(
    playersOf(state)
      .filter((p) => p.connected)
      .map((p) => p.id),
  );
}

export function nickOf(state: SpyPublicState, id: string): string {
  return state.players.get(id)?.nick ?? '';
}

/** Аватар-эмодзи в цветной рамке. */
export function avatarEl(p: IPlayer): HTMLElement {
  const color = FRAME_COLORS[p.frame] ?? 'transparent';
  const el = h('span', { class: 'spy-avatar' }, p.avatar);
  el.style.borderColor = color;
  if (p.frame !== 'none' && color !== 'transparent') el.classList.add('spy-avatar--framed');
  return el;
}

/** Ник с цветом из косметики (градиенты — через background-clip). */
export function nickEl(p: IPlayer, cls = 'spy-nick'): HTMLElement {
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

export interface PlayerButtonOptions {
  picked?: boolean;
  disabled?: boolean;
  onClick(): void;
}

/** Карточка игрока для сеток выбора (вопрос, голосование). */
export function playerButton(p: IPlayer, o: PlayerButtonOptions): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: `spy-pcard${o.picked ? ' spy-pcard--picked' : ''}${p.connected ? '' : ' spy-pcard--off'}`,
      disabled: o.disabled === true,
      onClick: o.onClick,
    },
    [avatarEl(p), nickEl(p)],
  );
}
