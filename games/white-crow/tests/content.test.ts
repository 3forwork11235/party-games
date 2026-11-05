import { describe, expect, it } from 'vitest';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { QUESTIONS, questionOf } from '../client/questions.js';
import { CROW_CATALOG } from '../shared/catalog.js';
import { RULES } from '../shared/config.js';
import { PACKS } from '../shared/packs.js';

type Dict = { [k: string]: string | Dict };
const LANGS = ['ru', 'kk', 'en'] as const;
const DICTS: Record<(typeof LANGS)[number], Dict> = { ru, kk, en };

function keys(d: Dict, prefix = ''): string[] {
  return Object.entries(d)
    .flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)))
    .sort();
}

function get(d: Dict, path: string): unknown {
  let cur: unknown = d;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Dict)[part];
  }
  return cur;
}

describe('UI-словари', () => {
  it('ключи ru/kk/en совпадают', () => {
    const base = keys(en as Dict);
    expect(keys(ru as Dict)).toEqual(base);
    expect(keys(kk as Dict)).toEqual(base);
  });

  for (const lang of LANGS) {
    it(`${lang}: нет пустых значений, есть shop/rule/pack`, () => {
      const d = DICTS[lang];
      for (const k of keys(d)) expect(String(get(d, k)).trim(), k).not.toBe('');
      for (const p of CROW_CATALOG) expect(get(d, `shop.${p.id}`), p.id).toBeTypeOf('string');
      for (const r of RULES) {
        expect(get(d, `crow.rule.${r}.name`)).toBeTypeOf('string');
        expect(get(d, `crow.rule.${r}.desc`)).toBeTypeOf('string');
      }
      for (const p of PACKS) expect(get(d, `crow.pack.${p.id}`)).toBeTypeOf('string');
      expect(get(d, 'crow.toast.peek')).toBeTypeOf('string');
      expect(get(d, 'crow.toast.peekUsed')).toBeTypeOf('string');
    });
  }
});

/** Один эмодзи-кластер: допускаем VS16, запрещаем ZWJ, модификаторы кожи и флаги. */
function isSimpleEmoji(s: string): boolean {
  if (/‍/.test(s)) return false;
  if (/[\u{1F3FB}-\u{1F3FF}]/u.test(s)) return false;
  if (/[\u{1F1E6}-\u{1F1FF}]/u.test(s)) return false;
  const base = s.replace(/️/g, '');
  return base.length > 0 && [...base].length === 1 && /\p{Extended_Pictographic}/u.test(base);
}

describe('вопросы', () => {
  for (const pack of PACKS) {
    const entries = QUESTIONS[pack.id];
    it(`${pack.id}: размер совпадает с PACKS`, () => {
      expect(entries).toHaveLength(pack.size);
    });
    it(`${pack.id}: эмодзи`, () => {
      for (const [i, e] of entries.entries()) {
        expect(e.e, `${pack.id}/${i}`).toHaveLength(6);
        e.e.forEach((x) => expect(isSimpleEmoji(x), `${pack.id}/${i} ${x}`).toBe(true));
        expect(new Set(e.e).size, `${pack.id}/${i} уникальность эмодзи`).toBe(6);
      }
    });
    for (const lang of LANGS) {
      it(`${pack.id}/${lang}: вопросы и варианты по правилам`, () => {
        const qs = new Set<string>();
        for (const [i, e] of entries.entries()) {
          const { q, o } = e[lang];
          const id = `${pack.id}/${i}/${lang}`;
          expect(q.trim().length, id).toBeGreaterThan(0);
          expect(q.length, id).toBeLessThanOrEqual(70);
          expect(q.trimEnd().endsWith('?'), id).toBe(true);
          expect(o, id).toHaveLength(6);
          for (const s of o) {
            expect(s.trim().length, id).toBeGreaterThanOrEqual(1);
            expect(s.length, `${id} "${s}"`).toBeLessThanOrEqual(22);
          }
          expect(new Set(o).size, `${id} уникальность вариантов`).toBe(6);
          expect(qs.has(q), `${id} дубль вопроса`).toBe(false);
          qs.add(q);
        }
      });
    }
  }

  it('questionOf берёт язык, fallback en и null для мусора', () => {
    const first = QUESTIONS.fantasy[0];
    expect(questionOf('fantasy/0', 'ru')?.q).toBe(first?.ru.q);
    expect(questionOf('fantasy/0', 'kk')?.options[2]?.label).toBe(first?.kk.o[2]);
    expect(questionOf('fantasy/0', 'xx')?.q).toBe(first?.en.q);
    expect(questionOf('fantasy/0', 'en')?.options[1]?.emoji).toBe(first?.e[1]);
    expect(questionOf('nope/1', 'en')).toBeNull();
    expect(questionOf('fantasy/99', 'en')).toBeNull();
  });
});
