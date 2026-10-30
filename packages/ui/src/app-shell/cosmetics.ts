import { AVATARS, FRAMES, NICK_COLORS, PREMIUM_AVATARS } from '@party/core/shared';
import type { Cosmetics, JoinOptions } from '@party/core/shared';
import type { CosmeticCategory, Entitlements, ProductDef } from '@party/monetization';
import type { PlatformAdapter } from '@party/platform';
import type { Profile } from './session.js';

const KEY = 'cosmetics';

type Slot = 'frame' | 'nickColor' | 'effect' | 'skin';
const SLOT_OF: Partial<Record<CosmeticCategory, Slot>> = {
  frame: 'frame',
  nickColor: 'nickColor',
  effect: 'effect',
  skin: 'skin',
};

/** Аватары для выбора: бесплатные + платные, на которые есть entitlement. */
export function availableAvatars(ent: Entitlements, catalog: readonly ProductDef[]): string[] {
  const bought = new Set(
    catalog
      .filter((p) => p.category === 'avatar' && ent.cosmetics.has(p.id))
      .map((p) => p.value ?? ''),
  );
  return [...AVATARS, ...PREMIUM_AVATARS.filter((a) => bought.has(a))];
}

function isKnown(slot: Slot, value: string): boolean {
  if (slot === 'frame') return FRAMES.includes(value);
  if (slot === 'nickColor') return value in NICK_COLORS;
  return value.length > 0;
}

function owns(
  slot: Slot,
  value: string,
  ent: Entitlements,
  catalog: readonly ProductDef[],
): boolean {
  if ((slot === 'frame' && value === 'none') || (slot === 'nickColor' && value === 'default')) {
    return true;
  }
  return catalog.some(
    (p) =>
      SLOT_OF[p.category as CosmeticCategory] === slot &&
      p.value === value &&
      ent.cosmetics.has(p.id),
  );
}

/** Оставляет только известные и купленные значения. */
export function sanitizeCosmetics(
  raw: unknown,
  ent: Entitlements,
  catalog: readonly ProductDef[],
): Cosmetics {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Cosmetics = {};
  for (const slot of ['frame', 'nickColor', 'effect', 'skin'] as const) {
    const v = src[slot];
    if (typeof v === 'string' && isKnown(slot, v) && owns(slot, v, ent, catalog)) out[slot] = v;
  }
  return out;
}

/** Выбранная косметика игрока; сохраняется через platform.saveData('cosmetics'). */
export interface CosmeticsStore {
  load(): Promise<void>;
  /** Текущий выбор (с учётом entitlement). */
  get(): Cosmetics;
  /** Выбрать купленный/полученный товар (рамка, цвет ника, эффект, скин). */
  select(product: ProductDef): Promise<void>;
}

export function createCosmeticsStore(
  platform: Pick<PlatformAdapter, 'loadData' | 'saveData'>,
  catalog: readonly ProductDef[],
  entitlements: () => Entitlements,
): CosmeticsStore {
  let raw: Cosmetics = {};
  return {
    async load() {
      raw = (await platform.loadData<Cosmetics>(KEY).catch(() => null)) ?? {};
    },
    get: () => sanitizeCosmetics(raw, entitlements(), catalog),
    async select(product) {
      const slot = product.category ? SLOT_OF[product.category] : undefined;
      if (!slot || !product.value) return;
      raw = { ...raw, [slot]: product.value };
      try {
        await platform.saveData(KEY, raw);
      } catch {
        /* хранилище недоступно — выбор живёт до перезапуска */
      }
    },
  };
}

/** Случайный ещё не полученный косметический товар для награды за рекламу. */
export function pickRewardProduct(
  catalog: readonly ProductDef[],
  ent: Entitlements,
  rnd: () => number = Math.random,
): ProductDef | null {
  const pool = catalog.filter((p) => p.kind === 'cosmetic' && !ent.cosmetics.has(p.id));
  return pool.length ? (pool[Math.floor(rnd() * pool.length) % pool.length] ?? null) : null;
}

export function buildJoinOptions(
  profile: Profile,
  lang: string,
  cosmetics: Cosmetics,
): JoinOptions {
  const o: JoinOptions = {
    playerId: profile.playerId,
    nick: profile.nick,
    avatar: profile.avatar,
    lang,
  };
  if (Object.keys(cosmetics).length) o.cosmetics = cosmetics;
  return o;
}
