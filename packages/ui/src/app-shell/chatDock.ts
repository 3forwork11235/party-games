import type { PartyClient } from '@party/core/client';
import type { ICoreState } from '@party/core/shared';
import type { TFunction } from '../types.js';
import { createChat, type Chat, type ChatMessage } from '../widgets/chat.js';

const BUFFER = 30;
export const CHAT_COOLDOWN_MS = 2000;

export interface ChatDock {
  /** Добавляет свёрнутый чат в контейнер; возвращает функцию отписки. */
  mount(parent: HTMLElement): () => void;
  destroy(): void;
}

/** Общий чат shell: история живёт между экранами, отправка блокируется на 2 с. */
export function createChatDock(
  client: Pick<PartyClient<ICoreState>, 'on' | 'send'>,
  t: TFunction,
  now: () => number = Date.now,
): ChatDock {
  const history: ChatMessage[] = [];
  let current: Chat | null = null;
  let lockedUntil = 0;
  const offMsg = client.on('core:chat', (m) => {
    const msg = { nick: m.nick, text: m.text };
    history.push(msg);
    if (history.length > BUFFER) history.shift();
    current?.addMessage(msg);
  });

  return {
    mount(parent) {
      let button: HTMLButtonElement | null = null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const chat = createChat({
        t,
        onSend: (text) => {
          if (now() < lockedUntil) return;
          lockedUntil = now() + CHAT_COOLDOWN_MS;
          client.send('core:chat', { text });
          if (button) button.disabled = true;
          timer = setTimeout(() => {
            if (button) button.disabled = false;
          }, CHAT_COOLDOWN_MS);
        },
      });
      button = chat.el.querySelector<HTMLButtonElement>('button[type="submit"]');
      for (const m of history) chat.addMessage(m);
      current = chat;
      parent.append(chat.el);
      return () => {
        clearTimeout(timer);
        if (current === chat) current = null;
        chat.destroy();
      };
    },
    destroy() {
      offMsg();
      current = null;
    },
  };
}
