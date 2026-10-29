import en from './locales/en.json';
import kk from './locales/kk.json';
import ru from './locales/ru.json';

export const SUPPORTED = ['ru', 'kk', 'en'] as const;
export type Lang = (typeof SUPPORTED)[number];

export interface Messages {
  [key: string]: string | Messages;
}
export type TParams = Record<string, string | number>;
export type TFunction = (key: string, params?: TParams) => string;

const FALLBACK: Lang = 'en';
const RU_GROUP = new Set(['be', 'uk', 'ky', 'uz', 'tg']);

/** Приводит произвольный языковой тег ('ru-RU', 'be', …) к поддерживаемому языку. */
export function resolveLanguage(raw: string | null | undefined): Lang {
  const base = (raw ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  if (base === 'ru' || base === 'kk' || base === 'en') return base;
  if (RU_GROUP.has(base)) return 'ru';
  return 'en';
}

function flatten(dict: Messages, prefix: string, out: Record<string, string>): void {
  for (const [k, v] of Object.entries(dict)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flatten(v, key, out);
  }
}

const catalogs: Record<Lang, Record<string, string>> = { ru: {}, kk: {}, en: {} };
for (const [lang, dict] of [
  ['ru', ru],
  ['kk', kk],
  ['en', en],
] as const) {
  flatten(dict as Messages, '', catalogs[lang]);
}

let current: Lang = FALLBACK;
const listeners = new Set<(lang: Lang) => void>();
const pluralRules = new Map<Lang, Intl.PluralRules>();

function rulesFor(lang: Lang): Intl.PluralRules {
  let r = pluralRules.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang);
    pluralRules.set(lang, r);
  }
  return r;
}

export function initI18n(lang: string): Lang {
  current = resolveLanguage(lang);
  return current;
}

export function getLanguage(): Lang {
  return current;
}

export function setLanguage(lang: string): void {
  const next = resolveLanguage(lang);
  if (next === current) return;
  current = next;
  for (const cb of [...listeners]) cb(current);
}

export function onLanguageChange(cb: (lang: Lang) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Глубоко вливает словарь (например, из games/<slug>/content) в каталог языка. */
export function registerMessages(lang: Lang, dict: Messages): void {
  flatten(dict, '', catalogs[lang]);
}

function lookup(lang: Lang, key: string, count: number | undefined): string | undefined {
  const cat = catalogs[lang];
  if (count !== undefined) {
    const plural = cat[`${key}_${rulesFor(lang).select(count)}`] ?? cat[`${key}_other`];
    if (plural !== undefined) return plural;
  }
  return cat[key];
}

function interpolate(text: string, params: TParams | undefined): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    return v === undefined ? m : String(v);
  });
}

export const t: TFunction = (key, params) => {
  const raw = params?.count;
  const count = typeof raw === 'number' ? raw : undefined;
  const text = lookup(current, key, count) ?? lookup(FALLBACK, key, count) ?? key;
  return interpolate(text, params);
};
