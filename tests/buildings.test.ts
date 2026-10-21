// Правила каталога научных баз: стабильные id, редкость, изображения и чистка сохранений.
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
