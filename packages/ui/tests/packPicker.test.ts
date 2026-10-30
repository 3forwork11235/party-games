// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPackPicker, type PackPickerOptions } from '../src/index.js';

const PACKS = [
  { id: 'a', free: true },
  { id: 'b', free: true },
  { id: 'c', free: false },
];

function make(owned: string[] = ['a', 'b'], extra: Partial<PackPickerOptions> = {}) {
  const onChange = vi.fn();
  const onSelect = vi.fn();
  const onBuy = vi.fn();
  const picker = createPackPicker({
    t: (k) => k,
    title: 'Packs',
    packs: PACKS,
    name: (id) => `name-${id}`,
    owned: () => new Set(owned),
    onChange,
    onBuy,
    onSelect,
    ...extra,
  });
  document.body.append(picker.el); // change у отсоединённых чекбоксов jsdom не шлёт
  return { picker, onChange, onSelect, onBuy };
}

const boxes = (el: HTMLElement): HTMLInputElement[] => [
  ...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
];

describe('createPackPicker', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('не-хост видит только выбранные паки, без чекбоксов и кнопок', () => {
    const { picker } = make();
    picker.update(['a'], false);
    expect(picker.el.querySelector('.p-packs__title')?.textContent).toBe('Packs');
    const rows = [...picker.el.querySelectorAll('.p-pack')];
    expect(rows.map((r) => r.textContent)).toEqual(['name-a']);
    expect(boxes(picker.el)).toHaveLength(0);
    expect(picker.el.querySelector('button')).toBeNull();
  });

  it('хост видит чекбоксы всех паков; некупленный — замок и кнопка покупки', () => {
    const { picker } = make();
    picker.update(['a'], true);
    const cb = boxes(picker.el);
    expect(cb.map((b) => b.checked)).toEqual([true, false, false]);
    expect(cb.map((b) => b.disabled)).toEqual([false, false, true]);
    expect(picker.el.querySelectorAll('.p-pack__lock')).toHaveLength(1);
    const buy = picker.el.querySelectorAll('.p-pack__buy');
    expect(buy).toHaveLength(1);
    expect(buy[0]?.textContent).toBe('ui.shop.buy');
  });

  it('включение пака зовёт onChange и onSelect (paid=false для бесплатного)', () => {
    const { picker, onChange, onSelect } = make();
    picker.update(['a'], true);
    boxes(picker.el)[1]?.click();
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    expect(onSelect).toHaveBeenCalledWith('b', false);
    expect(picker.el.querySelectorAll('.p-pack--on')).toHaveLength(2);
  });

  it('купленный платный пак включается с paid=true', () => {
    const { picker, onSelect } = make(['a', 'b', 'c']);
    picker.update(['a'], true);
    boxes(picker.el)[2]?.click();
    expect(onSelect).toHaveBeenCalledWith('c', true);
  });

  it('последний выбранный пак снять нельзя', () => {
    const { picker, onChange } = make();
    picker.update(['a'], true);
    const box = boxes(picker.el)[0];
    box?.click();
    expect(onChange).not.toHaveBeenCalled();
    picker.update(['a', 'b'], true);
    boxes(picker.el)[0]?.click();
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('локальный выбор не затирается, пока сервер не прислал новый список', () => {
    const { picker } = make();
    picker.update(['a'], true);
    boxes(picker.el)[1]?.click();
    picker.update(['a'], true); // тот же state до эха сервера
    expect(boxes(picker.el).map((b) => b.checked)).toEqual([true, true, false]);
    picker.update(['b'], true); // сервер прислал другое
    expect(boxes(picker.el).map((b) => b.checked)).toEqual([false, true, false]);
  });

  it('кнопка покупки открывает магазин; rerender учитывает новые покупки', () => {
    let owned = ['a', 'b'];
    let rerender: () => void = () => undefined;
    const onBuy = vi.fn((r: () => void) => {
      rerender = r;
    });
    const { picker } = make(undefined, { owned: () => new Set(owned), onBuy });
    picker.update(['a'], true);
    picker.el.querySelector<HTMLButtonElement>('.p-pack__buy')?.click();
    expect(onBuy).toHaveBeenCalledOnce();
    owned = ['a', 'b', 'c'];
    rerender();
    expect(picker.el.querySelector('.p-pack__buy')).toBeNull();
    expect(boxes(picker.el)[2]?.disabled).toBe(false);
  });

  it('destroy убирает элемент из DOM', () => {
    const { picker } = make();
    const root = document.createElement('div');
    root.append(picker.el);
    picker.destroy();
    expect(root.children).toHaveLength(0);
  });
});
