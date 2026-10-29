import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../src/locales/en.json';
import kk from '../src/locales/kk.json';
import ru from '../src/locales/ru.json';
import {
  getLanguage,
  initI18n,
  onLanguageChange,
  registerMessages,
  resolveLanguage,
  setLanguage,
  SUPPORTED,
  t,
} from '../src/index.js';

type Dict = { [k: string]: string | Dict };

function flat(d: Dict, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flat(v, key, out);
  }
  return out;
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (k: string): string => k.replace(PLURAL, '');
const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '');

beforeEach(() => {
  initI18n('en');
});

describe('resolveLanguage', () => {
  it('maps languages', () => {
    expect(SUPPORTED).toEqual(['ru', 'kk', 'en']);
    expect(resolveLanguage('ru-RU')).toBe('ru');
    expect(resolveLanguage('kk')).toBe('kk');
    expect(resolveLanguage('EN_us')).toBe('en');
    for (const l of ['be', 'uk', 'ky', 'uz', 'tg']) expect(resolveLanguage(l)).toBe('ru');
    expect(resolveLanguage('de')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });
});

describe('t', () => {
  it('substitutes params', () => {
    expect(t('core.toast.player_joined', { name: 'Аня' })).toBe('Аня joined');
  });

  it('falls back lang -> en -> key', () => {
    setLanguage('ru');
    registerMessages('en', { test: { only_en: 'English only' } });
    expect(t('test.only_en')).toBe('English only');
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('pluralizes ru', () => {
    setLanguage('ru');
    const f = (n: number): string => t('ui.lobby.players', { count: n });
    expect(f(1)).toBe('1 игрок');
    expect(f(2)).toBe('2 игрока');
    expect(f(5)).toBe('5 игроков');
    expect(f(21)).toBe('21 игрок');
    expect(f(22)).toBe('22 игрока');
    expect(f(11)).toBe('11 игроков');
  });

  it('pluralizes en and kk', () => {
    expect(t('ui.lobby.min_players', { count: 1 })).toBe('At least 1 player is required');
    expect(t('ui.lobby.min_players', { count: 2 })).toBe('At least 2 players are required');
    setLanguage('kk');
    expect(t('ui.lobby.min_players', { count: 3 })).toBe('Кемінде 3 ойыншы қажет');
  });

  it('registerMessages deep-merges', () => {
    registerMessages('en', { g: { a: 'A', b: { c: 'C' } } });
    registerMessages('en', { g: { d: 'D' } });
    expect([t('g.a'), t('g.b.c'), t('g.d')]).toEqual(['A', 'C', 'D']);
  });
});

describe('language change', () => {
  it('notifies only on change and can unsubscribe', () => {
    const cb = vi.fn();
    const off = onLanguageChange(cb);
    setLanguage('ru');
    setLanguage('ru');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('ru');
    off();
    setLanguage('kk');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(getLanguage()).toBe('kk');
  });
});

describe('locale files', () => {
  const sets = {
    ru: flat(ru as Dict),
    kk: flat(kk as Dict),
    en: flat(en as Dict),
  };
  const bases = (l: Record<string, string>): string[] => [...new Set(Object.keys(l).map(base))].sort();

  it('have the same keys (ignoring plural suffixes)', () => {
    expect(bases(sets.kk)).toEqual(bases(sets.ru));
    expect(bases(sets.en)).toEqual(bases(sets.ru));
  });

  it('have the same placeholders per key', () => {
    for (const lang of ['kk', 'en'] as const) {
      for (const [k, v] of Object.entries(sets[lang])) {
        const ruVal = sets.ru[k] ??sets.ru[`${base(k)}_other`];
        expect(placeholders(v).sort(), `${lang}:${k}`).toEqual(placeholders(ruVal ?? '').sort());
      }
    }
  });

  it('define _other for every plural group and no empty strings', () => {
    for (const [lang, l] of Object.entries(sets)) {
      for (const k of Object.keys(l)) {
        if (PLURAL.test(k)) expect(l[`${base(k)}_other`], `${lang}:${k}`).toBeDefined();
      }
      for (const [k, v] of Object.entries(l)) expect(v.length, `${lang}:${k}`).toBeGreaterThan(0);
    }
  });
});
