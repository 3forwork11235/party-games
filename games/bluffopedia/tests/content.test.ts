import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Lang } from '@party/i18n';
import { describe, expect, it, vi } from 'vitest';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { buildRevealPlan, shownCount } from '../client/revealPlan.js';
import { HELLO_GAP_MS, HELLO_GRACE_MS, createYouTracker, parseYou } from '../client/you.js';
import { BLUFF_CATALOG } from '../shared/catalog.js';
import { MSG_HELLO, MSG_YOU } from '../shared/messages.js';
import { PACKS } from '../shared/packs.js';

type Dict = { [k: string]: string | Dict };
const LANGS: Lang[] = ['ru', 'kk', 'en'];
const dicts: Record<Lang, Dict> = { ru, kk, en } as Record<Lang, Dict>;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function keys(d: Dict, prefix = ''): string[] {
  return Object.entries(d)
    .flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)))
    .sort();
}

function lookup(d: Dict, p: string): string | undefined {
  let cur: string | Dict | undefined = d;
  for (const part of p.split('.')) {
    if (typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

describe('UI-словари', () => {
  it('ключи ru/kk/en совпадают', () => {
    const base = keys(en as Dict);
    expect(keys(ru as Dict)).toEqual(base);
    expect(keys(kk as Dict)).toEqual(base);
  });

  it('нет пустых значений, плейсхолдеры совпадают между языками', () => {
    const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of keys(en as Dict)) {
      const base = lookup(en as Dict, key) ?? '';
      for (const lang of LANGS) {
        const text = lookup(dicts[lang], key) ?? '';
        expect(text.trim(), `${lang}:${key}`).not.toBe('');
        expect(placeholders(text), `${lang}:${key}`).toEqual(placeholders(base));
      }
    }
  });

  it('есть название игры, паки, тосты и shop.* для каждого товара', () => {
    for (const lang of LANGS) {
      expect(lookup(dicts[lang], 'game.title')).toBeTruthy();
      for (const p of PACKS) expect(lookup(dicts[lang], `bluff.pack.${p.id}`), p.id).toBeTruthy();
      for (const k of ['empty', 'truth', 'nohint']) {
        expect(lookup(dicts[lang], `bluff.toast.${k}`), `${lang}:${k}`).toBeTruthy();
      }
      for (const item of BLUFF_CATALOG) {
        expect(item.titleKey, item.id).toBe(`shop.${item.id}`);
        expect(lookup(dicts[lang], item.titleKey ?? ''), `${lang}:${item.id}`).toBeTruthy();
      }
    }
  });
});

interface Q {
  q: string;
  a: string;
  alt: string[];
  fake: string[];
  src?: string;
}
type PackFile = Record<Lang, Q[]>;

describe('банк вопросов (SPEC §6)', () => {
  for (const pack of PACKS) {
    const file = path.join(ROOT, 'content', 'questions', `${pack.id}.json`);
    const data = JSON.parse(readFileSync(file, 'utf8')) as PackFile;
    for (const lang of LANGS) {
      it(`${pack.id}/${lang}: ${pack.size} записей по правилам`, () => {
        const list = data[lang];
        expect(list).toHaveLength(pack.size);
        const seen = new Set<string>();
        list.forEach((item, i) => {
          const where = `${pack.id}/${lang}#${i}`;
          expect(item.q.split('___').length - 1, `${where} ___`).toBe(1);
          expect(item.q.length, `${where} q`).toBeLessThanOrEqual(160);
          expect(item.a.trim(), `${where} a`).not.toBe('');
          expect(item.a.length, `${where} a`).toBeLessThanOrEqual(30);
          expect(item.a.trim().split(/\s+/).length, `${where} a words`).toBeLessThanOrEqual(4);
          expect(Array.isArray(item.alt), `${where} alt`).toBe(true);
          expect(item.alt.length, `${where} alt`).toBeLessThanOrEqual(3);
          expect(item.fake, `${where} fake`).toHaveLength(2);
          const answers = [item.a, ...item.alt].map((s) => s.toLowerCase());
          for (const f of item.fake) {
            expect(f.trim(), `${where} fake`).not.toBe('');
            expect(answers, `${where} fake=${f}`).not.toContain(f.toLowerCase());
          }
          if (lang === 'en') expect(item.src, `${where} src`).toBeTruthy();
          expect(seen.has(item.q), `${where} дубль`).toBe(false);
          seen.add(item.q);
        });
      });
    }
  }
});

describe('клиент не знает ответов', () => {
  it('ни один файл client/* не импортирует content/questions или server/', () => {
    const dir = path.join(ROOT, 'client');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/content\/questions/);
      expect(src, f).not.toMatch(/from\s+['"][^'"]*server\//);
    }
  });
});

describe('you (bluffopedia:you)', () => {
  type Handler = (msg: unknown) => void;
  function setup() {
    let handler: Handler = () => undefined;
    const sent: string[] = [];
    const now = { v: 1000 };
    let changes = 0;
    const tracker = createYouTracker(
      {
        onGame: ((type: string, cb: Handler) => {
          if (type === MSG_YOU) handler = cb;
          return () => {
            handler = () => undefined;
          };
        }) as never,
        sendGame: (type) => void sent.push(type),
      },
      () => changes++,
      () => now.v,
    );
    return { sent, push: (m: unknown) => handler(m), now, changed: () => changes, tracker };
  }

  it('parseYou отбрасывает мусор и нормализует поля', () => {
    expect(parseYou(null)).toBeNull();
    expect(parseYou({ round: '1' })).toBeNull();
    expect(parseYou({ round: 2, lie: 5, ownId: 'o1' })).toEqual({
      round: 2,
      lie: '',
      ownId: 'o1',
      hintId: '',
    });
  });

  it('шлёт hello при создании и хранит данные только своего раунда', () => {
    const { sent, push, tracker, changed } = setup();
    expect(sent).toEqual([MSG_HELLO]);
    push({ round: 2, lie: 'x', ownId: '', hintId: '' });
    expect(changed()).toBe(1);
    expect(tracker.get(2)?.lie).toBe('x');
    expect(tracker.get(3)).toBeNull();
    push({ round: 1, lie: 'old', ownId: '', hintId: '' });
    expect(tracker.get(2)?.lie).toBe('x');
  });

  it('повторяет hello, если в round нет данных, не чаще раза в 2 с', () => {
    vi.useFakeTimers();
    try {
      const { sent, now, tracker, push } = setup();
      tracker.sync({ phase: 'round', round: 1 });
      now.v += HELLO_GRACE_MS;
      vi.advanceTimersByTime(HELLO_GRACE_MS);
      expect(sent).toHaveLength(1);
      now.v += HELLO_GAP_MS;
      vi.advanceTimersByTime(HELLO_GAP_MS);
      expect(sent).toHaveLength(2);
      push({ round: 1, lie: '', ownId: '', hintId: '' });
      tracker.sync({ phase: 'round', round: 1 });
      now.v += HELLO_GAP_MS * 3;
      vi.advanceTimersByTime(HELLO_GAP_MS * 3);
      expect(sent).toHaveLength(2);
      tracker.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('план раскрытия', () => {
  const options = [
    { id: 'o1', text: 'правда' },
    { id: 'o2', text: 'x' },
    { id: 'o3', text: 'y' },
    { id: 'o4', text: 'игра' },
  ];
  const lies = new Map([
    ['A', 'o2'],
    ['C', 'o2'],
    ['B', 'o3'],
  ]);
  const votes = new Map([
    ['A', 'o3'],
    ['B', 'o1'],
    ['C', 'o3'],
    ['D', 'o2'],
  ]);

  it('выдумки по возрастанию голосов, правда последней, очки авторам', () => {
    const plan = buildRevealPlan(options, 'o1', lies, votes);
    expect(plan.map((e) => e.id)).toEqual(['o4', 'o2', 'o3', 'o1']);
    expect(plan[0]).toMatchObject({ kind: 'house', authors: [], voters: [], points: 0 });
    expect(plan[1]).toMatchObject({ kind: 'lie', authors: ['A', 'C'], voters: ['D'], points: 1 });
    expect(plan[2]).toMatchObject({ kind: 'lie', authors: ['B'], voters: ['A', 'C'], points: 2 });
    expect(plan[3]).toMatchObject({ kind: 'truth', voters: ['B'], points: 2 });
  });

  it('shownCount: минимум 1, шаг по времени, не больше total', () => {
    expect(shownCount(0, 5000, 1000)).toBe(0);
    expect(shownCount(4, -300, 1000)).toBe(1);
    expect(shownCount(4, 999, 1000)).toBe(1);
    expect(shownCount(4, 2000, 1000)).toBe(3);
    expect(shownCount(4, 99000, 1000)).toBe(4);
  });
});
