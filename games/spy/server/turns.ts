import { nextAsker } from '../shared/logic.js';
import type { SpyState } from '../shared/state.js';

/** Порядок входа и подключённые игроки (отключённые в окне реконнекта в очереди не участвуют). */
export interface Roster {
  order: readonly string[];
  connected: ReadonlySet<string>;
}

/** Кого может спросить `asker`: подключённые, не он сам и не `lastAskerId` (если есть выбор). */
export function allowedTargets(asker: string, lastAskerId: string, roster: Roster): string[] {
  const others = roster.order.filter((id) => id !== asker && roster.connected.has(id));
  const fresh = others.filter((id) => id !== lastAskerId);
  return fresh.length > 0 ? fresh : others;
}

/** `spy:ask`: только спрашивающий и только пока цель не выбрана. */
export function applyAsk(
  state: SpyState,
  playerId: string,
  targetId: unknown,
  roster: Roster,
): boolean {
  if (playerId !== state.askerId || state.targetId !== '' || typeof targetId !== 'string') {
    return false;
  }
  if (!allowedTargets(playerId, state.lastAskerId, roster).includes(targetId)) return false;
  state.targetId = targetId;
  return true;
}

/** `spy:answered`: только цель; она становится спрашивающим, вопрос засчитан. */
export function applyAnswered(state: SpyState, playerId: string): boolean {
  if (state.targetId === '' || playerId !== state.targetId) return false;
  state.lastAskerId = state.askerId;
  state.askerId = playerId;
  state.targetId = '';
  state.questions++;
  return true;
}

/** `spy:pass`: спрашивающий или хост передаёт ход следующему подключённому по порядку входа. */
export function applyPass(state: SpyState, playerId: string, roster: Roster): boolean {
  if (playerId !== state.askerId && playerId !== state.hostId) return false;
  moveAsker(state, roster);
  return true;
}

/** Игрок отключился: ушёл спрашивающий → ход дальше, ушла цель → вопрос снимается. */
export function applyLeave(state: SpyState, playerId: string, roster: Roster): void {
  if (playerId === state.askerId) moveAsker(state, roster);
  else if (playerId === state.targetId) state.targetId = '';
}

function moveAsker(state: SpyState, roster: Roster): void {
  state.askerId = nextAsker(roster.order, state.askerId, roster.connected);
  state.targetId = '';
  state.lastAskerId = '';
}
