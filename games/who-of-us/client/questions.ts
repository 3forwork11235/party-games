import { getLanguage, type Lang } from '@party/i18n';
import absurd from '../content/questions/absurd.json';
import family from '../content/questions/family.json';
import friends from '../content/questions/friends.json';
import party from '../content/questions/party.json';
import work from '../content/questions/work.json';

export type PackQuestions = Record<Lang, string[]>;

export const QUESTIONS: Record<string, PackQuestions> = {
  friends,
  family,
  work,
  absurd,
  party,
};

/** Текст вопроса по id `"<packId>/<index>"` на языке игрока (fallback — en). */
export function questionText(id: string, lang: Lang = getLanguage()): string {
  const [packId, idx] = id.split('/');
  const pack = packId ? QUESTIONS[packId] : undefined;
  const i = Number(idx);
  if (!pack || !Number.isInteger(i)) return '';
  return pack[lang]?.[i] || pack.en[i] || '';
}
