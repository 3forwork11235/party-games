import { h, openModal, type Modal } from '@party/ui';
import { rulesList, valuesBlock } from './rulesBlock.js';
import type { AimHint, SettingsStore } from './settings.js';
import type { BilliardsCtx } from './types.js';

export interface Menu {
  button: HTMLElement;
  isOpen(): boolean;
  destroy(): void;
}

type View = 'main' | 'settings' | 'rules' | 'confirm';

/** Кнопка ☰ и модальное меню: продолжить / настройки / правила / выйти. */
export function createMenu(ctx: BilliardsCtx, settings: SettingsStore): Menu {
  const { t } = ctx;
  let modal: Modal | null = null;
  const body = h('div', { class: 'eb-menu' });

  const btn = (label: string, onClick: () => void, kind = ''): HTMLElement =>
    h('button', { class: `p-btn${kind ? ` p-btn--${kind}` : ''}`, type: 'button', onClick }, label);

  const row = (label: string, control: HTMLElement): HTMLElement =>
    h('label', { class: 'eb-menu__row' }, [h('span', {}, label), control]);

  const check = (label: string, key: 'soundOn' | 'vibration' | 'handoff'): HTMLElement => {
    const input = h('input', { type: 'checkbox' });
    input.checked = settings.get()[key];
    input.addEventListener('change', () => settings.set({ [key]: input.checked }));
    return row(label, input);
  };

  const settingsView = (): HTMLElement[] => {
    const vol = h('input', { type: 'range', min: 0, max: 100, step: 5 });
    vol.value = String(Math.round(settings.get().volume * 100));
    const pct = h('span', { class: 'eb-menu__pct' }, `${vol.value}%`);
    vol.addEventListener('input', () => {
      pct.textContent = `${vol.value}%`;
      settings.set({ volume: Number(vol.value) / 100 });
    });
    const hints: AimHint[] = ['full', 'line', 'off'];
    const sel = h(
      'select',
      { class: 'p-input' },
      hints.map((k) => h('option', { value: k }, t(`billiards.settings.hint.${k}`))),
    );
    sel.value = settings.get().aimHint;
    sel.addEventListener('change', () => settings.set({ aimHint: sel.value as AimHint }));
    return [
      h('h2', { class: 'p-title' }, t('billiards.menu.settings')),
      check(t('billiards.settings.sound'), 'soundOn'),
      row(t('billiards.settings.volume'), h('span', { class: 'eb-menu__vol' }, [vol, pct])),
      row(t('billiards.settings.aimHint'), sel),
      check(t('billiards.settings.vibration'), 'vibration'),
      check(t('billiards.settings.handoff'), 'handoff'),
      btn(t('billiards.menu.back'), () => show('main')),
    ];
  };

  const views: Record<View, () => HTMLElement[]> = {
    main: () => [
      h('h2', { class: 'p-title' }, t('billiards.menu.title')),
      btn(t('billiards.menu.resume'), close, 'primary'),
      btn(t('billiards.menu.settings'), () => show('settings')),
      btn(t('billiards.menu.rules'), () => show('rules')),
      btn(t('billiards.menu.exit'), () => show('confirm'), 'danger'),
    ],
    settings: settingsView,
    rules: () => [
      h('h2', { class: 'p-title' }, t('billiards.menu.rules')),
      rulesList(t),
      valuesBlock(t),
      btn(t('billiards.menu.back'), () => show('main')),
    ],
    confirm: () => [
      h('h2', { class: 'p-title' }, t('billiards.menu.exit')),
      h('div', {}, t('billiards.menu.exitConfirm')),
      btn(
        t('billiards.menu.exitYes'),
        () => {
          close();
          void ctx.client.leave();
        },
        'danger',
      ),
      btn(t('billiards.menu.back'), () => show('main')),
    ],
  };

  function show(v: View): void {
    body.replaceChildren(...views[v]());
  }
  function close(): void {
    modal?.close();
  }
  const open = (): void => {
    if (modal) return;
    show('main');
    modal = openModal({
      content: body,
      onClose: () => {
        modal = null;
      },
    });
  };

  const button = h(
    'button',
    {
      class: 'eb-menu-btn',
      type: 'button',
      'aria-label': t('billiards.menu.title'),
      onClick: open,
    },
    '☰',
  );
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (modal) close();
    else open();
  };
  window.addEventListener('keydown', onKey);

  return {
    button,
    isOpen: () => modal !== null,
    destroy() {
      window.removeEventListener('keydown', onKey);
      close();
      button.remove();
    },
  };
}
