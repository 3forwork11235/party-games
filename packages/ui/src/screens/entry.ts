import { h } from '../dom.js';
import type { Component, TFunction } from '../types.js';

export interface EntryProps {
  t: TFunction;
  avatars: string[];
  nick?: string;
  avatar?: string;
  initialCode?: string;
  onCreate(nick: string, avatar: string): void;
  onJoin(code: string, nick: string, avatar: string): void;
}

export function createEntryScreen(props: EntryProps): Component {
  const { t } = props;
  let avatar = props.avatar ?? props.avatars[0] ?? '';
  const nick = h('input', {
    class: 'p-input',
    maxlength: 16,
    placeholder: t('ui.entry.nick'),
    autocomplete: 'off',
  });
  nick.value = props.nick ?? '';
  const code = h('input', {
    class: 'p-input' + (props.initialCode ? ' p-input--hl' : ''),
    maxlength: 5,
    placeholder: t('ui.entry.code'),
    autocomplete: 'off',
    autocapitalize: 'characters',
  });
  code.value = (props.initialCode ?? '').toUpperCase();

  const joinBtn = h(
    'button',
    {
      class: 'p-btn' + (props.initialCode ? ' p-btn--primary' : ''),
      type: 'button',
      onClick: () => props.onJoin(code.value, nick.value.trim(), avatar),
    },
    t('ui.entry.join'),
  );
  const onCode = (): void => {
    code.value = code.value.toUpperCase().replace(/[\s-]/g, '');
    joinBtn.disabled = code.value.length !== 5;
  };
  code.addEventListener('input', onCode);
  onCode();

  const buttons = props.avatars.map((a) =>
    h(
      'button',
      {
        class: 'p-avatar',
        type: 'button',
        'aria-pressed': a === avatar ? 'true' : 'false',
        onClick: () => {
          avatar = a;
          buttons.forEach((b) =>
            b.setAttribute('aria-pressed', b.textContent === a ? 'true' : 'false'),
          );
        },
      },
      a,
    ),
  );
  const createBtn = h(
    'button',
    {
      class: 'p-btn' + (props.initialCode ? '' : ' p-btn--primary'),
      type: 'button',
      onClick: () => props.onCreate(nick.value.trim(), avatar),
    },
    t('ui.entry.create'),
  );

  const el = h('div', { class: 'p-screen p-entry' }, [
    h('h1', { class: 'p-title' }, t('ui.entry.title')),
    h('label', { class: 'p-muted' }, t('ui.entry.nick')),
    nick,
    h('label', { class: 'p-muted' }, t('ui.entry.avatar')),
    h('div', { class: 'p-avatars' }, buttons),
    createBtn,
    h('div', { class: 'p-muted' }, t('ui.entry.or')),
    code,
    joinBtn,
  ]);
  return { el, destroy: () => el.remove() };
}
