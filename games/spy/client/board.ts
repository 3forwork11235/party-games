import { h, type Component } from '@party/ui';
import { locationEmoji, locationName } from './locations.js';

export interface BoardInput {
  /** Id локаций поля (24 шт.). */
  ids: readonly string[];
  /** Зачёркнутые подсказками (только у шпиона). */
  crossed: ReadonlySet<string>;
  /** Режим выбора: тап по локации — выбор догадки. */
  pick: boolean;
  picked: string;
}

export interface Board extends Component {
  update(input: BoardInput): void;
}

/** Поле локаций: сетка с прокруткой внутри блока. Клетки создаются один раз на набор id. */
export function createBoard(onPick: (id: string) => void): Board {
  const el = h('div', { class: 'spy-board' });
  const cells = new Map<string, HTMLButtonElement>();
  let key = '';
  let pickable = false;

  function build(ids: readonly string[]): void {
    el.textContent = '';
    cells.clear();
    for (const id of ids) {
      const cell = h(
        'button',
        {
          type: 'button',
          class: 'spy-loc',
          onClick: () => {
            if (pickable) onPick(id);
          },
        },
        [
          h('span', { class: 'spy-loc__emoji', 'aria-hidden': 'true' }, locationEmoji(id)),
          h('span', { class: 'spy-loc__name' }, locationName(id)),
        ],
      );
      cells.set(id, cell);
      el.append(cell);
    }
  }

  return {
    el,
    update(input) {
      const next = input.ids.join(',');
      if (next !== key) {
        key = next;
        build(input.ids);
      }
      pickable = input.pick;
      el.classList.toggle('spy-board--pick', input.pick);
      for (const [id, cell] of cells) {
        cell.classList.toggle('spy-loc--crossed', input.crossed.has(id));
        cell.classList.toggle('spy-loc--picked', input.pick && input.picked === id);
      }
    },
    destroy: () => el.remove(),
  };
}
