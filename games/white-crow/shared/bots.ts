import { BOT_DELAY_MS, type Rule } from './config.js';

/** Вероятность взять общий «любимый» вариант раунда. */
const FAV_CHANCE: Record<Rule, number> = { flock: 0.6, pair: 0.35, odd: 0 };

const pickOf = (options: readonly number[], rnd: () => number): number =>
  options[Math.min(options.length - 1, Math.floor(rnd() * options.length))] as number;

/** Выборы ботов на раунд; выборы людей боту неизвестны. */
export function planBotPicks(
  rule: Rule,
  options: number[],
  botIds: string[],
  rnd: () => number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (options.length === 0) return out;
  const fav = pickOf(options, rnd);
  for (const id of botIds) {
    out.set(id, rnd() < FAV_CHANCE[rule] ? fav : pickOf(options, rnd));
  }
  return out;
}

/** Задержка выбора бота, мс. */
export function botDelay(
  rnd: () => number,
  range: readonly [number, number] = BOT_DELAY_MS,
): number {
  return Math.round(range[0] + rnd() * (range[1] - range[0]));
}
