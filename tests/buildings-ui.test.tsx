// Витрина баз БУКа: карточки с отдельными иллюстрациями и редкостями, подробности,
// покупка с подтверждением и выбор базы для мира.
import { BUILDINGS } from '../src/engine/buildings';
import { useApp } from '../src/state/store';
import { check, click, sleep } from './ui-helpers';

function activeProfile() {
  const state = useApp.getState();
  return state.profiles.find((profile) => profile.id === state.activeId) ?? null;
}

function card(id: string): Element | null {
  return document.querySelector(`.building-item .building-card-art[data-building-id="${id}"]`)?.closest('.building-item') ?? null;
}

function buttonIn(el: Element | null, label: string): HTMLButtonElement | null {
  const found = Array.from(el?.querySelectorAll('button') ?? []).find((button) =>
    (button.textContent ?? '').includes(label),
  );
  return (found as HTMLButtonElement | undefined) ?? null;
}

export async function runBuildingUiChecks() {
  console.log('\n── Витрина БУКа: здания ──');
  const shelf = Array.from(document.querySelectorAll('.shop-cats .chip')).find((button) =>
    (button.textContent ?? '').includes('Здания'),
  );
  check('в витрине БУКа появилась полка «Здания»', !!shelf);
  if (!shelf) return;

  click(shelf);
  await sleep(30);
  check('раздел зданий открывает участок с выбранной постройкой', !!document.querySelector('.building-section') && !!document.querySelector('.building-plot'));
  check(
    'в витрине остались только четыре базы',
    ['Ядерная база', 'Электронная база', 'Арктическая база', 'Лунная база'].every((title) =>
      (document.querySelector('.building-section')?.textContent ?? '').includes(title),
    ),
  );
  const cards = Array.from(document.querySelectorAll('.building-item'));
  const artImages = cards.map((el) => el.querySelector<HTMLImageElement>('.building-card-art'));
  const artIds = artImages.map((img) => img?.getAttribute('data-building-id') ?? '');
  const artSources = artImages.map((img) => img?.getAttribute('src') ?? '');
  check(
    'каждое здание имеет отдельную детализированную WebP-иллюстрацию',
    cards.length === BUILDINGS.length &&
      new Set(artIds).size === BUILDINGS.length &&
      new Set(artSources).size === BUILDINGS.length &&
      artSources.every((src) => src.endsWith('.webp')),
    `${artImages.length} иллюстраций`,
  );
  const expectedRarities: Record<string, string> = {
    'atomic-base': 'top',
    'electron-base': 'legendary',
    'arctic-base': 'legendary',
    'moon-base': 'top',
  };
  check(
    'карточки показывают редкость каждой базы',
    cards.every((el) => {
      const id = el.querySelector('.building-card-art')?.getAttribute('data-building-id') ?? '';
      return el.querySelector('.rarity-chip')?.getAttribute('data-rarity') === expectedRarities[id];
    }),
  );

  const initial = activeProfile();
  if (!initial) return;
  const original = {
    gems: initial.gems,
    buildingsOwned: initial.shop?.buildingsOwned ?? [],
    activeBuilding: initial.shop?.activeBuilding ?? null,
  };

  // Изолируем покупочный сценарий от «всё открыто» в стартовом тестовом профиле.
  useApp.setState((state) => ({
    profiles: state.profiles.map((profile) =>
      profile.id === state.activeId
        ? { ...profile, gems: 0, shop: { ...profile.shop!, buildingsOwned: [], activeBuilding: null } }
        : profile,
    ),
  }));
  await sleep(20);
  check('нельзя купить здание без кристаллов', useApp.getState().buyBuilding('atomic-base') === false);

  useApp.setState((state) => ({
    profiles: state.profiles.map((profile) =>
      profile.id === state.activeId ? { ...profile, gems: 500 } : profile,
    ),
  }));
  await sleep(20);

  const atomicCard = card('atomic-base');
  click(atomicCard?.querySelector('.shop-title'));
  await sleep(25);
  const detail = document.querySelector('.shop-sheet');
  check('тап по карточке показывает большую иллюстрацию и описание здания', !!detail?.querySelector('.building-detail-art img[alt="Ядерная база"]') && (detail?.textContent ?? '').includes('научный центр'));
  click(buttonIn(detail, 'Построить · 💎120'));
  await sleep(25);
  check('перед покупкой появляется подтверждение стоимости', (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Отдашь 120 💎'));
  click(buttonIn(document.querySelector('[role="dialog"]'), 'Построить · 💎120'));
  await sleep(30);
  let profile = activeProfile();
  check(
    'покупка списывает кристаллы и ставит здание на участок',
    profile?.gems === 380 && profile.shop?.buildingsOwned?.includes('atomic-base') && profile.shop.activeBuilding === 'atomic-base',
    JSON.stringify({ gems: profile?.gems, buildings: profile?.shop?.buildingsOwned, active: profile?.shop?.activeBuilding }),
  );
  check('участок показывает выбранную ядерную базу', document.querySelector('.building-plot-art')?.getAttribute('alt') === 'Ядерная база');
  check('повторную покупку одного здания блокирует движок', useApp.getState().buyBuilding('atomic-base') === false);
  check('нельзя поставить неприобретённую постройку', useApp.getState().chooseBuilding('moon-base') === false);

  // Покупаем второй вариант и проверяем, что его можно поставить вместо первого.
  const electronCard = card('electron-base');
  click(buttonIn(electronCard, 'Купить · 💎105'));
  await sleep(20);
  click(buttonIn(document.querySelector('[role="dialog"]'), 'Построить · 💎105'));
  await sleep(30);
  profile = activeProfile();
  check('вторая база сохраняется рядом с первой', profile?.shop?.buildingsOwned?.includes('atomic-base') && profile.shop.buildingsOwned.includes('electron-base'));
  click(buttonIn(card('atomic-base'), 'Поставить'));
  await sleep(30);
  check('можно переключить участок на уже купленную постройку', activeProfile()?.shop?.activeBuilding === 'atomic-base');
  click(buttonIn(card('electron-base'), 'Поставить'));
  await sleep(30);
  check('выбранная база сразу меняет большую сцену участка', activeProfile()?.shop?.activeBuilding === 'electron-base' && document.querySelector('.building-plot-art')?.getAttribute('alt') === 'Электронная база');

  click(Array.from(document.querySelectorAll('.shop-seg button')).find((button) =>
    (button.textContent ?? '').includes('Гардероб'),
  ));
  await sleep(25);
  const wardrobe = document.querySelector('[aria-label="Мои здания"]');
  const buildingRows = Array.from(wardrobe?.querySelectorAll('.shop-wear') ?? []);
  check('купленные базы видны в «Гардеробе» → «Мои здания»', buildingRows.length === 2 && !!wardrobe?.textContent?.includes('Электронная база'));
  const atomicRow = buildingRows.find((row) => row.getAttribute('aria-label') === 'Ядерная база') ?? null;
  click(buttonIn(atomicRow, 'Поставить'));
  await sleep(25);
  check('здание можно поставить на участок прямо из гардероба', activeProfile()?.shop?.activeBuilding === 'atomic-base');
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((button) =>
    (button.textContent ?? '').includes('Витрина'),
  ));
  await sleep(20);
  click(Array.from(document.querySelectorAll('.shop-cats .chip')).find((button) =>
    (button.textContent ?? '').includes('Здания'),
  ));
  await sleep(20);

  // Возвращаем исходную коллекцию, чтобы остальные smoke-сценарии не зависели от этого теста.
  useApp.setState((state) => ({
    profiles: state.profiles.map((profile) =>
      profile.id === state.activeId
        ? {
            ...profile,
            gems: original.gems,
            shop: {
              ...profile.shop!,
              buildingsOwned: original.buildingsOwned,
              activeBuilding: original.activeBuilding,
            },
          }
        : profile,
    ),
  }));
  await sleep(25);
  const outfits = Array.from(document.querySelectorAll('.shop-cats .chip')).find((button) =>
    (button.textContent ?? '').includes('Наряды'),
  );
  if (outfits) click(outfits);
  await sleep(20);
}
