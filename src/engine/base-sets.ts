import { BUILDING_BY_ID } from './buildings';
import { ITEM_BY_ID, type ItemRarity, RARITY_ORDER } from './shop';
import { COSTUME_BY_ID } from './puzzles';

/** A themed bundle contains one scientific base, its matching car and costume. */
export interface BaseSet {
  id: string;
  baseId: string;
  carId: string;
  costumeId: string;
  title: string;
  desc: string;
  emoji: string;
  rarity: ItemRarity;
}

export const BASE_SETS: BaseSet[] = [
  { id: 'atomic-set', baseId: 'atomic-base', carId: 'car-atomic-base', costumeId: 'atomic-suit', title: 'Набор «Атом»', desc: 'Ядерная база, машина «Квант» и костюм Хранителя атома', emoji: '⚛️', rarity: 'top' },
  { id: 'electron-set', baseId: 'electron-base', carId: 'car-electron-base', costumeId: 'electron-suit', title: 'Набор «Импульс»', desc: 'Электронная база, машина «Импульс» и костюм Повелителя импульса', emoji: '🔋', rarity: 'legendary' },
  { id: 'arctic-set', baseId: 'arctic-base', carId: 'car-arctic-base', costumeId: 'arctic-suit', title: 'Набор «Полярный»', desc: 'Арктическая база, вездеход «Полярник» и костюм исследователя', emoji: '🧊', rarity: 'legendary' },
  { id: 'moon-set', baseId: 'moon-base', carId: 'car-moon-base', costumeId: 'moon-suit', title: 'Набор «Луна»', desc: 'Лунная база, машина «Луноход» и костюм первооткрывателя', emoji: '🌙', rarity: 'top' },
];

/** Pay for missing pieces only; the bundle discount applies when buying all three. */
export function baseSetPrice(
  set: BaseSet,
  ownedItems: string[],
  ownedBuildings: string[],
  assembledCostumes: string[],
): number {
  const missingPrices = [
    !ownedBuildings.includes(set.baseId) ? BUILDING_BY_ID[set.baseId]?.price ?? 0 : 0,
    !ownedItems.includes(set.carId) ? ITEM_BY_ID[set.carId]?.price ?? 0 : 0,
    !assembledCostumes.includes(set.costumeId) ? COSTUME_BY_ID[set.costumeId]?.price ?? 0 : 0,
  ];
  const total = missingPrices.reduce((sum, price) => sum + price, 0);
  const allMissing = missingPrices.every((price) => price > 0);
  return allMissing ? Math.floor(total * 0.9) : total;
}

export function baseSetRarityIndex(set: BaseSet): number {
  return RARITY_ORDER.indexOf(set.rarity);
}
