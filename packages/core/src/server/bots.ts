import { BOT_AVATAR, BOT_ID_PREFIX, BOT_NICKS } from '../shared/bots.js';
import { Player } from './schema.js';

/** Создаёт игрока-бота: id `bot:<n>`, ник — первый свободный из BOT_NICKS. */
export function createBotPlayer(n: number, takenNicks: ReadonlySet<string>): Player {
  const p = new Player();
  p.id = `${BOT_ID_PREFIX}${n}`;
  p.nick = BOT_NICKS.find((x) => !takenNicks.has(x)) ?? `${BOT_NICKS[0]}${n}`;
  p.avatar = BOT_AVATAR;
  p.connected = true;
  p.ready = true;
  p.sessionId = '';
  return p;
}
