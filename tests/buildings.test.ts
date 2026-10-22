// Правила каталога научных баз: стабильные id, редкость, изображения и чистка сохранений.
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_SETS, baseSetPrice } from '../src/engine/base-sets';
import { ITEM_BY_ID } from '../src/engine/shop';
import { CRYSTAL_COSTUMES } from '../src/engine/puzzles';
import {
  BUILDINGS,
  BUILDING_BY_ID,
  DEFAULT_BUILDING_ID,
  WORLD_BASES,
  isBuildingOwned,
  normalizeActiveBuilding,
  normalizeBuildingsOwned,
  normalizeWorldBase,
} from '../src/engine/buildings';

assert.equal(BUILDINGS.length, 4, 'в каталоге остались четыре базы');
assert.equal(new Set(BUILDINGS.map((building) => building.id)).size, BUILDINGS.length, 'id баз уникальны');
assert.ok(BUILDINGS.every((building) => building.isBase && building.title.trim() && building.desc.trim() && building.price > 0));
assert.deepEqual(BUILDINGS.map((base) => base.rarity), ['top', 'legendary', 'legendary', 'top']);
assert.equal(BUILDING_BY_ID['atomic-base']?.price, Math.max(...BUILDINGS.map((base) => base.price)), 'атомная база самая дорогая');
for (const base of BUILDINGS) {
  const costume = CRYSTAL_COSTUMES.find((entry) => entry.baseStyle === base.id);
  assert.equal(costume?.rarity, base.rarity, `${base.title}: костюм совпадает по редкости`);
}
const atomicSet = BASE_SETS.find((set) => set.id === 'atomic-set')!;
assert.equal(baseSetPrice(atomicSet, [], [], []), 2100, 'атомный премиум-набор учитывает самолёт и стоит втрое дороже компонентов');
assert.equal(baseSetPrice(atomicSet, [atomicSet.carId], [atomicSet.baseId], [atomicSet.costumeId]), ITEM_BY_ID[atomicSet.planeId].price * 3, 'цена набора учитывает только недостающий самолёт');
for (const set of BASE_SETS) {
  const plane = ITEM_BY_ID[set.planeId];
  assert.equal(plane?.toy, 'plane', `${set.title}: в набор входит самолёт`);
  assert.equal(plane?.baseStyle, set.baseId, `${set.title}: самолёт соответствует теме базы`);
}
for (const building of BUILDINGS) {
  const imagePath = join(process.cwd(), 'public', 'buildings', `${building.id}.webp`);
  assert.ok(existsSync(imagePath), `есть WebP-иллюстрация для ${building.id}`);
  assert.ok(statSync(imagePath).size < 600 * 1024, `${building.id}: изображение оптимизировано для мобильного приложения`);
}
assert.ok(BUILDING_BY_ID['atomic-base'], 'есть ядерная база');
assert.ok(BUILDING_BY_ID['electron-base'], 'есть электронная база');
assert.ok(BUILDING_BY_ID['arctic-base'], 'есть арктическая база');
assert.equal(BUILDING_BY_ID['moon-base']?.title, 'Лунная база');
assert.equal(BUILDING_BY_ID.skyscraper, undefined, 'небоскрёб удалён из каталога');
assert.equal(BUILDING_BY_ID['luxury-village'], undefined, 'жилые здания удалены из каталога');
assert.equal(BUILDING_BY_ID[DEFAULT_BUILDING_ID]?.title, 'Ядерная база');
assert.deepEqual(WORLD_BASES.map((base) => base.id), ['atomic-base', 'electron-base', 'arctic-base', 'moon-base']);
assert.equal(normalizeWorldBase('arctic-base', ['arctic-base']), 'arctic-base');
assert.equal(normalizeWorldBase('arctic-base', []), null, 'нельзя выбрать неприобретённую базу');
assert.equal(normalizeWorldBase('unknown-home', ['unknown-home']), null, 'неизвестное здание не меняет фон мира');

assert.deepEqual(normalizeBuildingsOwned(null), []);
assert.deepEqual(normalizeBuildingsOwned('atomic-base'), []);
assert.deepEqual(
  normalizeBuildingsOwned(['atomic-base', 'unknown-building', 'atomic-base', 7, 'arctic-base', 'skyscraper']),
  ['atomic-base', 'arctic-base'],
);
assert.equal(normalizeActiveBuilding('atomic-base', ['atomic-base']), 'atomic-base');
assert.equal(normalizeActiveBuilding('atomic-base', []), null, 'нельзя выбрать неприобретённую базу');
assert.equal(normalizeActiveBuilding('skyscraper', ['skyscraper']), null, 'удалённое здание очищается из старого сохранения');
assert.equal(isBuildingOwned(['atomic-base'], 'atomic-base'), true);
assert.equal(isBuildingOwned([], 'atomic-base'), false);
