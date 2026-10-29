/** Очки за раунд по числу нажатий (чистая логика, легко тестируется). */
export function pointsForTaps(taps: number): number {
  return Math.max(0, Math.floor(taps));
}
