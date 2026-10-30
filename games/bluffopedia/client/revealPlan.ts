import { POINTS } from '../shared/config.js';

export interface RevealOption {
  id: string;
  text: string;
}

export type RevealKind = 'truth' | 'lie' | 'house';

export interface RevealEntry {
  id: string;
  text: string;
  kind: RevealKind;
  /** Авторы выдумки (пусто у правды и выдумки игры). */
  authors: string[];
  /** Кто выбрал этот вариант. */
  voters: string[];
  /** Очки каждому автору (= число выбравших) или каждому угадавшему (правда). */
  points: number;
}

/**
 * Порядок раскрытия: выдумки по возрастанию числа голосов (при равенстве — исходный порядок),
 * правда последней.
 */
export function buildRevealPlan(
  options: readonly RevealOption[],
  truthId: string,
  lies: ReadonlyMap<string, string>,
  votes: ReadonlyMap<string, string>,
): RevealEntry[] {
  const entries = options.map((o, index): RevealEntry & { index: number } => {
    const voters = [...votes].filter(([, opt]) => opt === o.id).map(([who]) => who);
    const authors = [...lies].filter(([, opt]) => opt === o.id).map(([who]) => who);
    const kind: RevealKind = o.id === truthId ? 'truth' : authors.length > 0 ? 'lie' : 'house';
    return {
      index,
      id: o.id,
      text: o.text,
      kind,
      authors: kind === 'truth' ? [] : authors,
      voters,
      points: kind === 'truth' ? POINTS.truth : voters.length * POINTS.fooled,
    };
  });
  entries.sort((a, b) => {
    if ((a.kind === 'truth') !== (b.kind === 'truth')) return a.kind === 'truth' ? 1 : -1;
    return a.voters.length - b.voters.length || a.index - b.index;
  });
  return entries.map((e) => ({
    id: e.id,
    text: e.text,
    kind: e.kind,
    authors: e.authors,
    voters: e.voters,
    points: e.points,
  }));
}

/** Сколько вариантов уже показано через `elapsedMs` после начала roundEnd (минимум 1). */
export function shownCount(total: number, elapsedMs: number, stepMs: number): number {
  if (total <= 0) return 0;
  return Math.min(total, 1 + Math.floor(Math.max(0, elapsedMs) / stepMs));
}
