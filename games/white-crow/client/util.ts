import { h } from '@party/ui';
import { FRAME_COLORS } from '@party/ui/app-shell';
import type { IPlayer } from '@party/core/shared';
import type { CrowPublicState } from '../shared/types.js';

export function listOf(src: readonly string[] | undefined): string[] {
  return src ? [...src] : [];
}

export function numsOf(src: readonly number[] | undefined): number[] {
  return src ? [...src] : [];
}

export function playersOf(state: CrowPublicState): IPlayer[] {
  return [...state.players.values()];
}

/** MapSchema (или plain-объект в тестах) → Map<string, number>. */
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

export const RULE_EMOJI = { flock: '🐦', pair: '💞', odd: '🤍' } as const;

export function ruleEmoji(rule: string): string {
  return (RULE_EMOJI as Record<string, string>)[rule] ?? '🐦';
}

/** Аватар-эмодзи в цветной рамке. */
export function avatarEl(p: IPlayer): HTMLElement {
  const color = FRAME_COLORS[p.frame] ?? 'transparent';
  const el = h('span', { class: 'crow-avatar' }, p.avatar);
  el.style.borderColor = color;
  if (p.frame !== 'none' && color !== 'transparent') el.classList.add('crow-avatar--framed');
  return el;
}

/** Плашка игрока: аватар + ник (аватары у игроков могут совпадать). */
export function playerChip(p: IPlayer, ...extra: (HTMLElement | string)[]): HTMLElement {
  return h('span', { class: 'crow-pl' }, [
    avatarEl(p),
    h('span', { class: 'crow-pl__nick' }, p.nick),
    ...extra,
  ]);
}
