import { AVATARS, sanitizeNick } from '@party/core/shared';
import type { EliteBilliardsState } from '../shared/state.js';

/** Нужная часть комнаты: бот-игроки движка. */
export interface GuestHost {
  state: EliteBilliardsState;
  addBot(setup: (bot: { nick: string; avatar: string }) => void): string | null;
  kick(id: string): void;
  isBot(id: string): boolean;
}

/** Может ли отправитель управлять стрелком: он сам или владелец гостя-стрелка. */
export function canControl(
  guests: { get(id: string): string | undefined },
  senderId: string,
  shooterId: string,
): boolean {
  return shooterId !== '' && (shooterId === senderId || guests.get(shooterId) === senderId);
}

/** Подключён ли игрок (гость — если подключён владелец). */
export function isPresent(state: EliteBilliardsState, id: string): boolean {
  const owner = state.guests.get(id);
  return state.players.get(owner ?? id)?.connected === true;
}

/** Уникальный ник: добавляет цифру при совпадении. */
export function uniqueNick(raw: unknown, taken: ReadonlySet<string>, index: number): string {
  const base = Array.from(sanitizeNick(raw, index)).slice(0, 14).join('');
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  return `${base}${index}`;
}

export function pickAvatar(raw: unknown): string {
  return typeof raw === 'string' && AVATARS.includes(raw) ? raw : (AVATARS[0] ?? '🙂');
}

/** Добавить гостя владельцу (только lobby, только человек). */
export function addGuest(host: GuestHost, ownerId: string, raw: unknown): void {
  const s = host.state;
  if (s.phase !== 'lobby' || host.isBot(ownerId) || !s.players.get(ownerId)) return;
  const msg = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const taken = new Set<string>();
  s.players.forEach((p) => taken.add(p.nick));
  const id = host.addBot((bot) => {
    bot.nick = uniqueNick(msg.nick, taken, s.players.size + 1);
    bot.avatar = pickAvatar(msg.avatar);
  });
  if (id !== null) s.guests.set(id, ownerId);
}

/** Лобби: убрать гостей, чей игрок или владелец исчез (игрок-гость кикается как бот). */
export function sweepGuests(host: GuestHost): void {
  const s = host.state;
  if (s.phase !== 'lobby') return;
  const gone: string[] = [];
  s.guests.forEach((owner, guest) => {
    if (!s.players.get(guest) || !s.players.get(owner)) gone.push(guest);
  });
  for (const guest of gone) {
    s.guests.delete(guest);
    if (s.players.get(guest)) host.kick(guest);
  }
}
