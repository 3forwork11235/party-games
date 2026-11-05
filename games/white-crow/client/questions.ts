import { getLanguage } from '@party/i18n';
import { parseQuestionId, type PackId } from '../shared/packs.js';
import everyday from '../content/questions/everyday.json';
import fantasy from '../content/questions/fantasy.json';
import food from '../content/questions/food.json';
import world from '../content/questions/world.json';

type Lang = 'ru' | 'kk' | 'en';
interface Entry {
  e: string[];
  ru: { q: string; o: string[] };
  kk: { q: string; o: string[] };
  en: { q: string; o: string[] };
}

export const QUESTIONS: Record<PackId, Entry[]> = {
  everyday: everyday as Entry[],
  fantasy: fantasy as Entry[],
  food: food as Entry[],
  world: world as Entry[],
};

export interface QuestionView {
  q: string;
  options: { emoji: string; label: string }[];
}

/** Вопрос и 6 вариантов на языке игрока (fallback en); индекс варианта общий для языков. */
export function questionOf(id: string, lang: string = getLanguage()): QuestionView | null {
  const parsed = parseQuestionId(id);
  if (!parsed) return null;
  const entry = QUESTIONS[parsed.pack][parsed.index];
  if (!entry) return null;
  const l: Lang = lang === 'ru' || lang === 'kk' ? lang : 'en';
  const text = entry[l] ?? entry.en;
  return {
    q: text.q,
    options: entry.e.map((emoji, i) => ({ emoji, label: text.o[i] ?? '' })),
  };
}
