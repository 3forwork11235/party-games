// Единственное место, где подключается серверный банк вопросов. Клиент его НЕ импортирует.
import facts from '../content/questions/facts.json';
import laws from '../content/questions/laws.json';
import records from '../content/questions/records.json';
import words from '../content/questions/words.json';
import { isLang, type Lang } from '../shared/config.js';
import { parseQuestionId, type PackId } from '../shared/packs.js';

export interface BankQuestion {
  q: string;
  a: string;
  alt: string[];
  fake: string[];
}

type PackFile = Record<Lang, BankQuestion[]>;

const BANK: Record<PackId, PackFile> = {
  words: words as unknown as PackFile,
  facts: facts as unknown as PackFile,
  laws: laws as unknown as PackFile,
  records: records as unknown as PackFile,
};

/** Запись вопроса `"<pack>/<idx>"` на языке `lang`; `null`, если её нет. */
export function getQuestion(id: string, lang: string): BankQuestion | null {
  const parsed = parseQuestionId(id);
  if (!parsed || !isLang(lang)) return null;
  const item = BANK[parsed.pack]?.[lang]?.[parsed.index];
  if (!item) return null;
  return { q: item.q, a: item.a, alt: item.alt ?? [], fake: item.fake ?? [] };
}
