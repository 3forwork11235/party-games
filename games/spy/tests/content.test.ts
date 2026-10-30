import type { Lang } from '@party/i18n';
import { describe, expect, it, vi } from 'vitest';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { LOCATIONS, locationEmoji, locationName, roleName } from '../client/locations.js';
import { HELLO_GAP_MS, HELLO_GRACE_MS, createRoleTracker, parseRole } from '../client/role.js';
import { revealEvents, type RevealFacts } from '../client/stats.js';
import { SPY_CATALOG } from '../shared/catalog.js';
import { MSG_HELLO, MSG_ROLE, ROLES_PER_LOCATION } from '../shared/index.js';
import { PACKS, locationIds } from '../shared/packs.js';

type Dict = { [k: string]: string | Dict };
const LANGS: Lang[] = ['ru', 'kk', 'en'];
const dicts: Record<Lang, Dict> = { ru, kk, en } as Record<Lang, Dict>;

function keys(d: Dict, prefix = ''): string[] {
  return Object.entries(d)
    .flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)))
    .sort();
}

function lookup(d: Dict, path: string): string | undefined {
  let cur: string | Dict | undefined = d;
  for (const part of path.split('.')) {
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

  it('есть название игры, названия паков и товаров каталога', () => {
    for (const lang of LANGS) {
      expect(lookup(dicts[lang], 'game.title')).toBeTruthy();
      for (const p of PACKS) expect(lookup(dicts[lang], `spy.pack.${p.id}`), p.id).toBeTruthy();
      for (const item of SPY_CATALOG) {
        expect(item.titleKey, item.id).toBeTruthy();
        expect(lookup(dicts[lang], item.titleKey ?? ''), `${lang}:${item.id}`).toBeTruthy();
      }
    }
  });

  it('есть тексты всех исходов раунда', () => {
    for (const lang of LANGS) {
      for (const o of ['spy_guessed', 'spy_wrong', 'spy_caught', 'spy_escaped']) {
        expect(lookup(dicts[lang], `spy.reveal.outcome.${o}`), `${lang}:${o}`).toBeTruthy();
      }
    }
  });
});

describe('локации', () => {
  for (const pack of PACKS) {
    it(`${pack.id}: ${pack.size} эмодзи`, () => {
      const emoji = LOCATIONS[pack.id].emoji;
      expect(emoji).toHaveLength(pack.size);
      for (const e of emoji) expect(e.trim()).not.toBe('');
    });
    for (const lang of LANGS) {
      it(`${pack.id}/${lang}: ${pack.size} записей по ${ROLES_PER_LOCATION + 1} непустых строк`, () => {
        const list = LOCATIONS[pack.id][lang];
        expect(list).toHaveLength(pack.size);
        for (const entry of list) {
          expect(entry).toHaveLength(ROLES_PER_LOCATION + 1);
          for (const s of entry) expect(s.trim()).not.toBe('');
          expect(new Set(entry.slice(1)).size, entry[0]).toBe(ROLES_PER_LOCATION);
        }
      });
    }
  }

  for (const lang of LANGS) {
    it(`${lang}: названия локаций уникальны`, () => {
      const names = PACKS.flatMap((p) => LOCATIONS[p.id][lang].map((e) => e[0] ?? ''));
      expect(names).toHaveLength(120);
      expect(new Set(names).size).toBe(names.length);
    });
  }

  it('locationName / locationEmoji / roleName берут язык и индекс', () => {
    expect(locationName('city/0', 'ru')).toBe(LOCATIONS.city.ru[0]?.[0]);
    expect(locationName('city/0', 'en')).toBe(LOCATIONS.city.en[0]?.[0]);
    expect(roleName('space/3', 2, 'kk')).toBe(LOCATIONS.space.kk[3]?.[3]);
    expect(locationEmoji('history/19')).toBe(LOCATIONS.history.emoji[19]);
  });

  it('язык без данных → en, неверный id → пустая строка', () => {
    expect(locationName('travel/1', 'xx' as Lang)).toBe(LOCATIONS.travel.en[1]?.[0]);
    expect(roleName('travel/1', 0, 'xx' as Lang)).toBe(LOCATIONS.travel.en[1]?.[1]);
    for (const bad of ['', 'nope/1', 'city/20', 'city/-1', 'city']) {
      expect(locationName(bad, 'en'), bad).toBe('');
      expect(locationEmoji(bad), bad).toBe('');
    }
    expect(roleName('city/0', -1, 'en')).toBe('');
    expect(roleName('city/0', 7, 'en')).toBe('');
  });

  it('каждый id поля из shared есть в контенте', () => {
    for (const id of locationIds(PACKS.map((p) => p.id))) {
      expect(locationName(id, 'ru'), id).not.toBe('');
      expect(locationEmoji(id), id).not.toBe('');
    }
  });
});

describe('роль (spy:role)', () => {
  type Handler = (msg: unknown) => void;
  function setup(): {
    sent: string[];
    push: Handler;
    now: { v: number };
    changed: () => number;
    tracker: ReturnType<typeof createRoleTracker>;
  } {
    let handler: Handler = () => undefined;
    const sent: string[] = [];
    const now = { v: 1000 };
    let changes = 0;
    const tracker = createRoleTracker(
      {
        onGame: ((type: string, cb: Handler) => {
          if (type === MSG_ROLE) handler = cb;
          return () => {
            handler = () => undefined;
          };
        }) as never,
        sendGame: (type) => void sent.push(type),
      },
      () => changes++,
      () => now.v,
    );
    return { sent, push: (m) => handler(m), now, changed: () => changes, tracker };
  }

  it('parseRole отбрасывает мусор и нормализует поля', () => {
    expect(parseRole(null)).toBeNull();
    expect(parseRole({ round: '1', spy: true })).toBeNull();
    expect(
      parseRole({ round: 2, spy: false, locationId: 'city/1', roleIndex: 3, crossed: 5 }),
    ).toEqual({
      round: 2,
      spy: false,
      locationId: 'city/1',
      roleIndex: 3,
      crossed: [],
      hintsLeft: 0,
    });
  });

  it('шлёт hello при создании и хранит роль только своего раунда', () => {
    const { sent, push, tracker, changed } = setup();
    expect(sent).toEqual([MSG_HELLO]);
    push({ round: 2, spy: true, crossed: ['a/1'], hintsLeft: 2 });
    expect(changed()).toBe(1);
    expect(tracker.get(2)?.crossed).toEqual(['a/1']);
    expect(tracker.get(3)).toBeNull();
    push({ round: 1, spy: false, crossed: [], hintsLeft: 0 });
    expect(tracker.get(2)?.spy).toBe(true);
  });

  it('повторяет hello, если в round нет роли, не чаще раза в 2 с', () => {
    vi.useFakeTimers();
    try {
      const { sent, now, tracker, push } = setup();
      tracker.sync({ phase: 'round', round: 1 });
      now.v += HELLO_GRACE_MS;
      vi.advanceTimersByTime(HELLO_GRACE_MS);
      expect(sent).toHaveLength(1); // hello при создании было < 2 с назад
      now.v += HELLO_GAP_MS;
      vi.advanceTimersByTime(HELLO_GAP_MS);
      expect(sent).toHaveLength(2);
      push({ round: 1, spy: false, locationId: 'city/0', roleIndex: 0, crossed: [], hintsLeft: 0 });
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

describe('аналитика раскрытия', () => {
  const base: RevealFacts = {
    round: 2,
    spyId: 'p1',
    locationId: 'city/4',
    accusedId: '',
    guessId: '',
    outcome: 'spy_escaped',
    players: 4,
  };

  it('шлёт только клиент шпиона и только после публикации исхода', () => {
    expect(revealEvents('p2', base)).toEqual({});
    expect(revealEvents('p1', { ...base, outcome: '' })).toEqual({});
    expect(revealEvents('', base)).toEqual({});
  });

  it('spy_escaped → spy_won без догадки', () => {
    expect(revealEvents('p1', base)).toEqual({
      won: { game: 'spy', round: 2, reason: 'escaped', players: 4 },
    });
  });

  it('досрочная верная догадка: location_guessed(early, correct) + spy_won(guessed)', () => {
    const ev = revealEvents('p1', { ...base, outcome: 'spy_guessed', guessId: 'city/4' });
    expect(ev.guessed).toEqual({
      game: 'spy',
      round: 2,
      locationId: 'city/4',
      correct: true,
      early: true,
    });
    expect(ev.won?.reason).toBe('guessed');
  });

  it('неверная догадка в последний шанс: не early, победы нет', () => {
    const ev = revealEvents('p1', {
      ...base,
      outcome: 'spy_caught',
      accusedId: 'p1',
      guessId: 'city/5',
    });
    expect(ev.guessed).toMatchObject({ correct: false, early: false });
    expect(ev.won).toBeUndefined();
  });
});
