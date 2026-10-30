import { clear, h } from '../dom.js';
import type { Component, TFunction } from '../types.js';

export interface PackPickerOptions {
  t: TFunction;
  /** Заголовок блока (уже переведён). */
  title: string;
  packs: readonly { id: string; free: boolean }[];
  name(id: string): string;
  /** Доступные игроку паки (бесплатные + купленные). */
  owned(): ReadonlySet<string>;
  /** Хост изменил выбор (всегда ≥ 1 пак). */
  onChange(ids: string[]): void;
  /** Открыть магазин; после закрытия вызвать rerender. */
  onBuy(rerender: () => void): void;
  /** Хост включил пак (для аналитики). */
  onSelect?(id: string, paid: boolean): void;
}

export interface PackPicker extends Component {
  /** selected — выбор из состояния сервера. Хосту показываются чекбоксы, остальным — выбранное. */
  update(selected: readonly string[], isHost: boolean): void;
}

/** Блок выбора паков контента в лобби: общий для игр с платными паками. */
export function createPackPicker(o: PackPickerOptions): PackPicker {
  const title = h('div', { class: 'p-packs__title' }, o.title);
  const list = h('div', { class: 'p-packs__list' });
  const el = h('div', { class: 'p-packs' }, [title, list]);

  let selected = new Set<string>();
  let isHost = false;
  let sig = '';

  const toggle = (id: string, paid: boolean): void => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
      o.onSelect?.(id, paid);
    }
    selected = next;
    o.onChange([...next]);
    render();
  };

  function render(): void {
    const owned = o.owned();
    clear(list);
    for (const p of o.packs) {
      const has = owned.has(p.id);
      const on = selected.has(p.id);
      const label = o.name(p.id);
      if (!isHost) {
        if (on) list.append(h('div', { class: 'p-pack p-pack--on' }, label));
        continue;
      }
      const row = h('div', { class: `p-pack${on ? ' p-pack--on' : ''}` });
      const box = h('input', { type: 'checkbox', disabled: !has });
      box.checked = on && has;
      box.addEventListener('change', () => toggle(p.id, !p.free));
      row.append(
        h('label', { class: 'p-pack__label' }, [box, h('span', { class: 'p-pack__name' }, label)]),
      );
      if (!has) {
        row.append(
          h('span', { class: 'p-pack__lock', 'aria-hidden': 'true' }, '🔒'),
          h(
            'button',
            { type: 'button', class: 'p-btn p-pack__buy', onClick: () => o.onBuy(render) },
            o.t('ui.shop.buy'),
          ),
        );
      }
      list.append(row);
    }
  }

  return {
    el,
    update(server, host) {
      // Локальный выбор хоста не затираем, пока сервер не прислал новый список.
      const next = `${server.join(',')}|${host}`;
      if (next !== sig) {
        sig = next;
        selected = new Set(server);
        isHost = host;
      }
      render();
    },
    destroy: () => el.remove(),
  };
}
