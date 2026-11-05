/** Боты: игроки без клиента, их ходы делает игра. */
export const BOT_ID_PREFIX = 'bot:';
export const BOT_AVATAR = '🤖';
export const BOT_NICKS = ['Robo', 'Chip', 'Pixel', 'Byte', 'Nova', 'Echo', 'Bolt', 'Zed'] as const;

export function isBotId(id: string): boolean {
  return id.startsWith(BOT_ID_PREFIX);
}
