/** Очки за место по порядку финиша: 1-е — 3, 2-е — 2, 3-е — 1. */
const PLACE_POINTS = [3, 2, 1];

/** Очки раунда: playerId → очки. Не дошедшие до цели в finishOrder отсутствуют (0). */
export function scoreRound(finishOrder: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  finishOrder.forEach((id, i) => {
    out[id] = PLACE_POINTS[i] ?? 0;
  });
  return out;
}

/** Скользящее окно: допускает не более `max` событий за последние `windowMs` мс. */
export function createTapLimiter(
  max: number,
  windowMs: number,
): { allow(now: number): boolean; reset(): void } {
  let times: number[] = [];
  return {
    allow(now) {
      times = times.filter((t) => now - t < windowMs);
      if (times.length >= max) return false;
      times.push(now);
      return true;
    },
    reset() {
      times = [];
    },
  };
}
