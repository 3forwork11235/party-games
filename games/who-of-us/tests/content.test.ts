import { describe, expect, it } from 'vitest';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { QUESTIONS, questionText } from '../client/questions.js';
import { PACKS } from '../shared/packs.js';

type Dict = { [k: string]: string | Dict };

function keys(d: Dict, prefix = ''): string[] {
  return Object.entries(d)
    .flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)))
    .sort();
}

describe('UI-словари', () => {
  it('ключи ru/kk/en совпадают', () => {
    const base = keys(en as Dict);
    expect(keys(ru as Dict)).toEqual(base);
    expect(keys(kk as Dict)).toEqual(base);
  });

  it('нет пустых значений', () => {
    for (const d of [ru, kk, en]) {
      const walk = (x: string | Dict): void => {
        if (typeof x === 'string') expect(x.trim()).not.toBe('');
        else Object.values(x).forEach(walk);
      };
      walk(d as Dict);
    }
  });
});

describe('вопросы', () => {
  for (const pack of PACKS) {
    for (const lang of ['ru', 'kk', 'en'] as const) {
      it(`${pack.id}/${lang}: ${pack.size} непустых уникальных строк`, () => {
        const list = QUESTIONS[pack.id]?.[lang] ?? [];
        expect(list).toHaveLength(pack.size);
        for (const q of list) expect(q.trim()).not.toBe('');
        expect(new Set(list).size).toBe(list.length);
      });
    }
  }

  it('questionText берёт язык и учитывает индекс', () => {
    expect(questionText('friends/0', 'ru')).toBe(QUESTIONS.friends?.ru[0]);
    expect(questionText('work/59', 'en')).toBe(QUESTIONS.work?.en[59]);
    expect(questionText('nope/1', 'en')).toBe('');
  });
});
