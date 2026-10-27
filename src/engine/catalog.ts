/**
 * Единый каталог всего, что можно открыть, продать и выкупить обратно.
 *
 * Раньше sell-back работал только для `SHOP_ITEMS` (наряды и техника), а
 * здания, костюмы, музыка, звуки, краски, облики сундуков, темы и наборы
 * оставались «вечными». Теперь у каждого товара есть:
 *
 *  • стабильный ключ с пространством имён (`engine/sold.ts`);
 *  • цена выкупа и честная цена сдачи;
 *  • чистые функции `ownsCatalog`, `sellCatalogEntry`, `buyCatalogEntry`.
 *
 * Стор и UI не знают деталей каждой полки: они работают с одним `CatalogEntry`.
 * Базовые состояния (базовый цвет вещи, «classic»-оформление, первый облик
 * сундука) считаются встроенными, но тоже участвуют в каталоге: их можно
 * продать за 0 💎 и выкупить обратно бесплатно.
 */

import type { Profile, ShopState, ShopTuning } from '../types';
import {
  BUILDINGS,
  BUILDING_BY_ID,
  DEFAULT_BUILDING_ID,
  isBuildingOwned,
} from './buildings';
import { BASE_SETS } from './base-sets';
import { BASE_SKIN, CHEST_SKINS, skinById, skinState, type ChestSkinId } from './chests';
import {
  MUSIC_BY_ID,
  MUSIC_TRACKS,
  migrateMusicShop,
} from './music';
import {
  ALL_COSTUMES,
  COSTUME_BY_ID,
  CRYSTAL_COSTUMES,
  OVERFLOW_GEMS,
  PUZZLE_COSTUMES,
  PUZZLE_SIZE,
  normalizePuzzle,
  type Costume,
} from './puzzles';
import {
  ITEM_BY_ID,
  SELL_RATE,
  SHOP_ITEMS,
  sellPrice,
  type ShopItem,
} from './shop';
import {
  DEFAULT_SOUND_PACK,
  SOUND_PACK_BY_ID,
  SOUND_PACKS,
  normalizeSoundShop,
} from './sounds';
import {
  BASE_TINT,
  COSTUME_PALETTES,
  TINT_PALETTES,
  TINT_PRICE,
  unlockedTints,
} from './tints';
import { THEME_STYLES, type ThemeStyle } from './theme-styles';
import { catalogKey, isSold, normalizeSold, tintKey, withSold, withoutSold } from './sold';
export { tintKey } from './sold';

export type CatalogKind =
  | 'item'
  | 'building'
  | 'crystalCostume'
  | 'puzzleCostume'
  | 'track'
  | 'sound'
  | 'tint'
  | 'chestSkin'
  | 'theme'
  | 'baseSet';

export interface CatalogEntry {
  /** Уникальный ключ с пространством имён; используется в `Profile.sold`. */
  key: string;
  /** Короткий id исходного каталога (например, `scarf` или `easy-lemon`). */
  id: string;
  kind: CatalogKind;
  title: string;
  emoji: string;
  /** Полная цена выкупа. У бесплатных/стартовых товаров — 0. */
  price: number;
  /** Ставка сдачи, которую показывает диалог продажи. */
  rate: number;
  /** Сколько кристаллов вернётся за товар. */
  refund: number;
  /** Для краски: какую вещь/костюм красим. */
  targetId?: string;
  /** Для краски: id дополнительного оттенка. */
  tintId?: string;
  /** Для набора: ключи отдельных частей. */
  parts?: string[];
}

export const CATALOG_GROUPS: { kind: CatalogKind; title: string; emoji: string }[] = [
  { kind: 'item', title: 'Наряды и техника', emoji: '🎩' },
  { kind: 'building', title: 'Здания и базы', emoji: '🏙️' },
  { kind: 'crystalCostume', title: 'Кристальные костюмы', emoji: '✨' },
  { kind: 'puzzleCostume', title: 'Костюмы за уроки', emoji: '🧩' },
  { kind: 'track', title: 'Музыка', emoji: '🎵' },
  { kind: 'sound', title: 'Звуки', emoji: '🔊' },
  { kind: 'tint', title: 'Дополнительные цвета', emoji: '🎨' },
  { kind: 'chestSkin', title: 'Облики сундуков', emoji: '🎁' },
  { kind: 'theme', title: 'Фоны оформления', emoji: '🖼️' },
  { kind: 'baseSet', title: 'Премиум-наборы', emoji: '🎁' },
];

/** Условная цена костюма, собиравшегося за уроки: 9 уроков × перелив 2 💎. */
export const PUZZLE_COSTUME_PRICE = PUZZLE_SIZE * OVERFLOW_GEMS;
/** Условная цена нестартового фона/облика — их раньше нельзя было купить. */
export const THEME_PRICE = 12;
export const CHEST_SKIN_PRICE = 12;

function refundFor(price: number, rate = 0.5): number {
  // ceil сохраняет хотя бы 1 💎 за недорогую краску; у бесплатных товаров 0.
  return Math.max(0, Math.ceil(price * rate));
}

function itemEntry(item: ShopItem): CatalogEntry {
  const rate = SELL_RATE[item.kind ?? 'outfit'];
  return {
    key: catalogKey('item', item.id),
    id: item.id,
    kind: 'item',
    title: item.title,
    emoji: item.emoji ?? '🎩',
    price: item.price,
    rate,
    // Для нарядов и техники сохраняем проверенные ставки 0.24.0.
    refund: sellPrice(item),
  };
}

function costumeTitle(costume: Costume, kind: 'crystalCostume' | 'puzzleCostume'): string {
  return kind === 'puzzleCostume' ? `${costume.title} (за уроки)` : costume.title;
}

const tintEntries: CatalogEntry[] = [];
for (const [targetId, palette] of [
  ...Object.entries(TINT_PALETTES),
  ...Object.entries(COSTUME_PALETTES),
] as [string, { base: { id: string; title: string }; extra: { id: string; title: string }[] }][]) {
  for (const tint of [palette.base, ...palette.extra]) {
    const isBase = tint.id === BASE_TINT;
    const price = isBase ? 0 : TINT_PRICE;
    const id = `${targetId}:${tint.id}`;
    tintEntries.push({
      key: tintKey(targetId, tint.id),
      id,
      kind: 'tint',
      title: `${targetId} — ${tint.title}${isBase ? ' (базовый)' : ''}`,
      emoji: '🎨',
      price,
      rate: 0.5,
      refund: refundFor(price),
      targetId,
      tintId: tint.id,
    });
  }
}

const baseSetEntries: CatalogEntry[] = BASE_SETS.map((setInfo) => {
  const parts = [
    catalogKey('building', setInfo.baseId),
    catalogKey('item', setInfo.carId),
    catalogKey('item', setInfo.planeId),
    catalogKey('crystalCostume', setInfo.costumeId),
  ];
  const price =
    (BUILDING_BY_ID[setInfo.baseId]?.price ?? 0) +
    (ITEM_BY_ID[setInfo.carId]?.price ?? 0) +
    (ITEM_BY_ID[setInfo.planeId]?.price ?? 0) +
    (COSTUME_BY_ID[setInfo.costumeId]?.price ?? 0);
  return {
    key: catalogKey('baseSet', setInfo.id),
    id: setInfo.id,
    kind: 'baseSet',
    title: setInfo.title,
    emoji: setInfo.emoji,
    price,
    rate: 0.5,
    refund: refundFor(price),
    parts,
  };
});

export const CATALOG: CatalogEntry[] = [
  ...SHOP_ITEMS.map(itemEntry),
  ...BUILDINGS.map((building) => ({
    key: catalogKey('building', building.id),
    id: building.id,
    kind: 'building' as const,
    title: building.title,
    emoji: building.emoji,
    price: building.price,
    rate: 0.5,
    refund: refundFor(building.price),
  })),
  ...CRYSTAL_COSTUMES.map((costume) => ({
    key: catalogKey('crystalCostume', costume.id),
    id: costume.id,
    kind: 'crystalCostume' as const,
    title: costumeTitle(costume, 'crystalCostume'),
    emoji: '✨',
    price: costume.price ?? 0,
    rate: 0.5,
    refund: refundFor(costume.price ?? 0),
  })),
  ...PUZZLE_COSTUMES.map((costume) => ({
    key: catalogKey('puzzleCostume', costume.id),
    id: costume.id,
    kind: 'puzzleCostume' as const,
    title: costumeTitle(costume, 'puzzleCostume'),
    emoji: '🧩',
    price: PUZZLE_COSTUME_PRICE,
    rate: 0.5,
    refund: refundFor(PUZZLE_COSTUME_PRICE),
  })),
  ...MUSIC_TRACKS.map((track) => ({
    key: catalogKey('track', track.id),
    id: track.id,
    kind: 'track' as const,
    title: track.title,
    emoji: track.emoji,
    price: track.price,
    rate: 0.5,
    refund: refundFor(track.price),
  })),
  ...SOUND_PACKS.map((pack) => ({
    key: catalogKey('sound', pack.id),
    id: pack.id,
    kind: 'sound' as const,
    title: pack.title,
    emoji: pack.emoji,
    price: pack.price,
    rate: 0.5,
    refund: refundFor(pack.price),
  })),
  ...tintEntries,
  ...CHEST_SKINS.map((skin) => {
    const price = skin.need === 0 ? 0 : CHEST_SKIN_PRICE + skin.need;
    return {
      key: catalogKey('chestSkin', skin.id),
      id: skin.id,
      kind: 'chestSkin' as const,
      title: skin.title,
      emoji: '🎁',
      price,
      rate: 0.5,
      refund: refundFor(price),
    };
  }),
  ...THEME_STYLES.map((style) => {
    const price = style.id === 'classic' ? 0 : THEME_PRICE;
    return {
      key: catalogKey('theme', style.id),
      id: style.id,
      kind: 'theme' as const,
      title: style.title,
      emoji: style.emoji,
      price,
      rate: 0.5,
      refund: refundFor(price),
    };
  }),
  ...baseSetEntries,
];

const BY_KEY = new Map(CATALOG.map((entry) => [entry.key, entry]));
const BY_ID = new Map<string, CatalogEntry>();
for (const entry of CATALOG) if (!BY_ID.has(entry.id)) BY_ID.set(entry.id, entry);

/** Найти товар по ключу или короткому id. Для неоднозначных id нужен ключ. */
export function catalogEntry(idOrKey: string): CatalogEntry | null {
  return BY_KEY.get(idOrKey) ?? BY_ID.get(idOrKey) ?? null;
}

export function catalogByKey(key: string): CatalogEntry | null {
  return BY_KEY.get(key) ?? null;
}

/** Короткая контрольная сумма каталога — для будущих миграций «всё открыто». */
function hash(text: string): string {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

export const CATALOG_VERSION = hash(
  CATALOG.map((entry) => `${entry.key}:${entry.price}:${entry.refund}`).join('|'),
);

/** Нормализованный гардероб без обращения к стору (чистая функция). */
function shopOf(p: Profile): ShopState {
  const raw = p.shop ?? { owned: [], equipped: {} };
  const music = migrateMusicShop(raw, p.sold);
  const sounds = normalizeSoundShop(raw, p.sold);
  const unlocked: Record<string, string[]> = {};
  if (raw.tuning?.unlocked && typeof raw.tuning.unlocked === 'object') {
    for (const [key, value] of Object.entries(raw.tuning.unlocked)) {
      if (Array.isArray(value)) unlocked[key] = value.filter((x): x is string => typeof x === 'string');
    }
  }
  return {
    ...raw,
    owned: Array.isArray(raw.owned) ? [...raw.owned] : [],
    equipped: { ...(raw.equipped ?? {}) },
    ...music,
    ...sounds,
    tuning: { current: { ...(raw.tuning?.current ?? {}) }, unlocked },
    wishlist: Array.isArray(raw.wishlist) ? [...raw.wishlist] : [],
    world: Array.isArray(raw.world) ? [...raw.world] : [],
    crystalCostumesOwned: [...(raw.crystalCostumesOwned ?? [])],
    buildingsOwned: [...(raw.buildingsOwned ?? [])],
    worldBase: raw.worldBase ?? null,
    activeBuilding: raw.activeBuilding ?? null,
  };
}

function withoutId(list: string[] | undefined, id: string): string[] {
  return (list ?? []).filter((value) => value !== id);
}

function addId(list: string[] | undefined, id: string): string[] {
  return (list ?? []).includes(id) ? [...(list ?? [])] : [...(list ?? []), id];
}

/** Есть ли сама вещь/костюм, к которому относится оттенок. */
function targetOwned(p: Profile, targetId: string): boolean {
  const shop = shopOf(p);
  return shop.owned.includes(targetId) ||
    (shop.crystalCostumesOwned ?? []).includes(targetId) ||
    normalizePuzzle(p.puzzle).assembled.includes(targetId);
}

function cleanTuning(tuning: ShopTuning | undefined, targetId: string): ShopTuning {
  const current = { ...(tuning?.current ?? {}) };
  delete current[targetId];
  const unlocked = Object.fromEntries(
    Object.entries(tuning?.unlocked ?? {}).filter(([key]) => key !== targetId),
  );
  return { current, unlocked };
}

/** Есть ли товар сейчас в коллекции профиля. */
export function ownsCatalog(p: Profile, entry: CatalogEntry): boolean {
  if (entry.kind === 'baseSet') {
    return (entry.parts ?? []).every((key) => {
      const part = catalogByKey(key);
      return part ? ownsCatalog(p, part) : false;
    });
  }
  const shop = shopOf(p);
  switch (entry.kind) {
    case 'item':
      return shop.owned.includes(entry.id);
    case 'building':
      return isBuildingOwned(shop.buildingsOwned, entry.id);
    case 'crystalCostume':
      return (shop.crystalCostumesOwned ?? []).includes(entry.id);
    case 'puzzleCostume':
      return normalizePuzzle(p.puzzle).assembled.includes(entry.id);
    case 'track':
      return (shop.musicOwned ?? []).includes(entry.id);
    case 'sound':
      return (shop.soundOwned ?? []).includes(entry.id);
    case 'tint':
      if (!entry.targetId || !entry.tintId || isSold(p, entry.key)) return false;
      if (entry.tintId === BASE_TINT) return targetOwned(p, entry.targetId);
      return unlockedTints(shop.tuning, entry.targetId).includes(entry.tintId);
    case 'chestSkin':
      return skinState(skinById(entry.id), p).unlocked;
    case 'theme':
      return !isSold(p, entry.key);
  }
}

/** Сколько стоит выкупить товар сейчас (набор — только недостающие части). */
export function priceOf(entry: CatalogEntry, p: Profile): number {
  if (entry.kind === 'baseSet') {
    return (entry.parts ?? []).reduce((sum, key) => {
      const part = catalogByKey(key);
      return sum + (part && !ownsCatalog(p, part) ? priceOf(part, p) : 0);
    }, 0);
  }
  return entry.price;
}

/** Сколько кристаллов вернётся прямо сейчас (набор — за принадлежащие части). */
export function refundOf(entry: CatalogEntry, p: Profile): number {
  if (entry.kind === 'baseSet') {
    return (entry.parts ?? []).reduce((sum, key) => {
      const part = catalogByKey(key);
      return sum + (part && ownsCatalog(p, part) ? refundOf(part, p) : 0);
    }, 0);
  }
  return entry.refund;
}

export interface CatalogMutation {
  profile: Profile;
  /** Для продажи — возврат кристаллов; для выкупа — списание. */
  amount: number;
}

function sellOne(p: Profile, entry: CatalogEntry): CatalogMutation | null {
  if (!ownsCatalog(p, entry)) return null;
  const shop = shopOf(p);
  const puzzle = normalizePuzzle(p.puzzle);
  const next: Profile = { ...p, shop, puzzle, sold: normalizeSold(p.sold) };
  // Краски «привязаны» к вещи или костюму: при продаже основы они уходят
  // вместе с ней и покупаются обратно отдельно — как дополнительные товары.
  const soldKeys = [entry.key];
  const tintsOfTarget = CATALOG.filter(
    (candidate) => candidate.kind === 'tint' && candidate.targetId === entry.id,
  ).map((candidate) => candidate.key);

  switch (entry.kind) {
    case 'item': {
      const item = ITEM_BY_ID[entry.id];
      const equipped = { ...shop.equipped };
      if (item && equipped[item.slot] === entry.id) delete equipped[item.slot];
      next.shop = {
        ...shop,
        owned: withoutId(shop.owned, entry.id),
        equipped,
        tuning: cleanTuning(shop.tuning, entry.id),
        wishlist: withoutId(shop.wishlist, entry.id),
        world: withoutId(shop.world, entry.id),
      };
      soldKeys.push(...tintsOfTarget);
      break;
    }
    case 'building': {
      const buildingsOwned = withoutId(shop.buildingsOwned, entry.id);
      next.shop = {
        ...shop,
        buildingsOwned,
        activeBuilding: shop.activeBuilding === entry.id ? (buildingsOwned[0] ?? null) : shop.activeBuilding,
        worldBase: shop.worldBase === entry.id ? null : shop.worldBase,
        world: withoutId(shop.world, entry.id),
      };
      break;
    }
    case 'crystalCostume': {
      next.shop = {
        ...shop,
        crystalCostumesOwned: withoutId(shop.crystalCostumesOwned, entry.id),
        tuning: cleanTuning(shop.tuning, entry.id),
        wishlist: withoutId(shop.wishlist, entry.id),
        world: withoutId(shop.world, entry.id),
      };
      next.puzzle = {
        ...puzzle,
        worn: puzzle.worn === entry.id ? null : puzzle.worn,
      };
      soldKeys.push(...tintsOfTarget);
      break;
    }
    case 'puzzleCostume': {
      const pieces = { ...puzzle.pieces, [entry.id]: 0 };
      next.puzzle = {
        pieces,
        collecting: puzzle.collecting === entry.id ? null : puzzle.collecting,
        assembled: withoutId(puzzle.assembled, entry.id),
        worn: puzzle.worn === entry.id ? null : puzzle.worn,
      };
      next.shop = {
        ...shop,
        tuning: cleanTuning(shop.tuning, entry.id),
        wishlist: withoutId(shop.wishlist, entry.id),
        world: withoutId(shop.world, entry.id),
      };
      soldKeys.push(...tintsOfTarget);
      break;
    }
    case 'track': {
      const musicOwned = withoutId(shop.musicOwned, entry.id);
      next.shop = {
        ...shop,
        musicOwned,
        musicTrack: shop.musicTrack === entry.id ? (musicOwned[0] ?? null) : shop.musicTrack,
        wishlist: withoutId(shop.wishlist, entry.id),
      };
      break;
    }
    case 'sound': {
      const soundOwned = withoutId(shop.soundOwned, entry.id);
      const fallback = soundOwned.includes(DEFAULT_SOUND_PACK)
        ? DEFAULT_SOUND_PACK
        : (soundOwned[0] ?? DEFAULT_SOUND_PACK);
      next.shop = {
        ...shop,
        soundOwned,
        soundPack: shop.soundPack === entry.id ? fallback : shop.soundPack,
      };
      break;
    }
    case 'tint': {
      const targetId = entry.targetId!;
      const tuning = shop.tuning ?? { current: {}, unlocked: {} };
      const current = { ...tuning.current };
      if (current[targetId] === entry.tintId) delete current[targetId];
      next.shop = {
        ...shop,
        tuning: {
          current,
          unlocked: {
            ...tuning.unlocked,
            [targetId]: withoutId(tuning.unlocked[targetId], entry.tintId!),
          },
        },
      };
      break;
    }
    case 'chestSkin': {
      next.chestSkins = withoutId(p.chestSkins, entry.id);
      next.chestSkin = p.chestSkin === entry.id ? BASE_SKIN : p.chestSkin;
      break;
    }
    case 'theme':
      // Темы — глобальная настройка; владение отмечается только ключом продажи.
      break;
    case 'baseSet':
      return null;
  }

  return { profile: withSold(next, soldKeys), amount: refundOf(entry, p) };
}

function buyOne(p: Profile, entry: CatalogEntry): CatalogMutation | null {
  if (ownsCatalog(p, entry)) return null;
  const shop = shopOf(p);
  const puzzle = normalizePuzzle(p.puzzle);
  const next: Profile = withoutSold(
    { ...p, shop, puzzle, sold: normalizeSold(p.sold) },
    [entry.key],
  );

  switch (entry.kind) {
    case 'item': {
      const item = ITEM_BY_ID[entry.id];
      next.shop = {
        ...shop,
        owned: addId(shop.owned, entry.id),
        equipped: item ? { ...shop.equipped, [item.slot]: entry.id } : shop.equipped,
        wishlist: withoutId(shop.wishlist, entry.id),
      };
      break;
    }
    case 'building':
      next.shop = {
        ...shop,
        buildingsOwned: addId(shop.buildingsOwned, entry.id),
        activeBuilding: entry.id,
      };
      break;
    case 'crystalCostume':
      next.shop = {
        ...shop,
        crystalCostumesOwned: addId(shop.crystalCostumesOwned, entry.id),
        wishlist: withoutId(shop.wishlist, entry.id),
      };
      next.puzzle = { ...puzzle, worn: entry.id };
      break;
    case 'puzzleCostume':
      next.puzzle = {
        ...puzzle,
        pieces: { ...puzzle.pieces, [entry.id]: PUZZLE_SIZE },
        assembled: addId(puzzle.assembled, entry.id),
        worn: entry.id,
      };
      next.shop = { ...shop, wishlist: withoutId(shop.wishlist, entry.id) };
      break;
    case 'track':
      next.shop = {
        ...shop,
        musicOwned: addId(shop.musicOwned, entry.id),
        musicTrack: entry.id,
        wishlist: withoutId(shop.wishlist, entry.id),
      };
      break;
    case 'sound':
      next.shop = {
        ...shop,
        soundOwned: addId(shop.soundOwned, entry.id),
        soundPack: entry.id,
      };
      break;
    case 'tint': {
      const targetId = entry.targetId!;
      const tuning = shop.tuning ?? { current: {}, unlocked: {} };
      next.shop = {
        ...shop,
        tuning: {
          current: { ...tuning.current, [targetId]: entry.tintId! },
          unlocked: {
            ...tuning.unlocked,
            [targetId]: addId(tuning.unlocked[targetId], entry.tintId!),
          },
        },
      };
      break;
    }
    case 'chestSkin':
      next.chestSkins = addId(p.chestSkins, entry.id);
      next.chestSkin = entry.id as ChestSkinId;
      break;
    case 'theme':
      // Снимаем ключ продажи; выбранный фон выставляет стор через настройки.
      break;
    case 'baseSet':
      return null;
  }

  return { profile: next, amount: priceOf(entry, p) };
}

/** Продать один товар. Для набора продаются все его части, возврат суммируется. */
export function sellCatalogEntry(p: Profile, entry: CatalogEntry): CatalogMutation | null {
  if (entry.kind === 'baseSet') {
    let current = p;
    let amount = 0;
    for (const key of entry.parts ?? []) {
      const part = catalogByKey(key);
      if (!part) continue;
      const result = sellOne(current, part);
      if (result) {
        current = result.profile;
        amount += result.amount;
      }
    }
    return amount > 0 || !ownsCatalog(current, entry)
      ? { profile: current, amount }
      : null;
  }
  return sellOne(p, entry);
}

/** Выкупить товар обратно. Для набора оплачиваются только недостающие части. */
export function buyCatalogEntry(p: Profile, entry: CatalogEntry): CatalogMutation | null {
  if (ownsCatalog(p, entry)) return null;
  if (entry.kind === 'baseSet') {
    let current = p;
    let amount = 0;
    for (const key of entry.parts ?? []) {
      const part = catalogByKey(key);
      if (!part) continue;
      const result = buyOne(current, part);
      if (result) {
        current = result.profile;
        amount += result.amount;
      }
    }
    return ownsCatalog(current, entry) ? { profile: current, amount } : null;
  }
  return buyOne(p, entry);
}

/** Продать всё, что можно продать по одному разу. Наборы не удваивают возврат. */
export function sellAllCatalog(p: Profile): CatalogMutation {
  let current = p;
  let amount = 0;
  for (const entry of CATALOG) {
    if (entry.kind === 'baseSet') continue;
    if (!ownsCatalog(current, entry)) continue;
    const result = sellOne(current, entry);
    if (result) {
      current = result.profile;
      amount += result.amount;
    }
  }
  return { profile: current, amount };
}

/** Товары, доступные профилю сейчас — для экрана продажи. */
export function ownedCatalog(p: Profile): CatalogEntry[] {
  return CATALOG.filter((entry) => ownsCatalog(p, entry));
}

/** Товары, которые сейчас можно выкупить обратно. */
export function soldCatalog(p: Profile): CatalogEntry[] {
  return CATALOG.filter((entry) => !ownsCatalog(p, entry));
}

/** Фоны, которые не проданы; первый используется как безопасный запасной. */
export function availableThemeStyles(p: Profile) {
  return THEME_STYLES.filter((style) => !isSold(p, catalogKey('theme', style.id)));
}

export function firstAvailableThemeStyle(p: Profile): ThemeStyle {
  return availableThemeStyles(p)[0]?.id ?? 'classic';
}

/** Все костюмы каталога — помогает UI не путать пазловые и кристальные. */
export const ALL_CATALOG_COSTUMES = ALL_COSTUMES;
export const CATALOG_COSTUME_BY_ID = COSTUME_BY_ID;
export const CATALOG_ITEM_BY_ID = ITEM_BY_ID;
export const CATALOG_MUSIC_BY_ID = MUSIC_BY_ID;
export const CATALOG_SOUND_BY_ID = SOUND_PACK_BY_ID;
export const CATALOG_DEFAULT_BUILDING_ID = DEFAULT_BUILDING_ID;
