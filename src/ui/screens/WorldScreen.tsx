import { useState } from 'react';
import { compareByRarity, ITEM_BY_ID, growthStage, isOwned, rarityOf, SHOP_ITEMS, type ShopItem } from '../../engine/shop';
import { normalizeWorld, WORLD_SLOTS } from '../../engine/world';
import { haptic } from '../../platform/haptics';
import { sfx } from '../../platform/sound';
import { masteredCount, useActiveProfile, useApp } from '../../state/store';
import { Mascot } from '../Mascot';
import { BayDecor } from '../TechScene';
import { ToyArt } from '../ToyArt';
import { RarityChip } from '../RarityChip';

/**
 * «Мой мир» (0.26.0): вкладка с выбранными вещами ребёнка.
 * Каждая вещь стоит на своей сцене: машина — в гараже, корабль — у пристани,
 * телефон — на полке (те же панели, что в ангаре), наряд — на мягком фоне.
 * «Выбрать» открывает список купленных вещей; тап по вещи ставит её в мир или
 * убирает. Техника рисуется картинкой ToyArt, наряды — маскотом БУКа в этом наряде.
 */
export function WorldScreen() {
  const profile = useActiveProfile();
  const toggleWorld = useApp((s) => s.toggleWorld);
  const showToast = useApp((s) => s.showToast);
  const [picking, setPicking] = useState(false);

  if (!profile) return null;

  const owned = profile.shop?.owned ?? [];
  const world = normalizeWorld(profile.shop?.world, owned);
  const tuning = profile.shop?.tuning;
  const growth = growthStage(masteredCount(profile));
  // Типы идут по возрастанию: обычный → крутой → легендарный → ТОПОВЫЙ (слоты и список).
  const shown = world.slice().sort((a, b) => compareByRarity(ITEM_BY_ID[a], ITEM_BY_ID[b]));
  const ownedItems = SHOP_ITEMS.filter((item) => isOwned(owned, item.id)).sort(compareByRarity);

  const tap = (id: string) => {
    sfx.tap();
    haptic.tap();
    const result = toggleWorld(id);
    if (result === 'full') {
      showToast({ emoji: '🌍', title: 'Мест нет', text: `В «Моём мире» уже ${WORLD_SLOTS} вещи. Уберите одну` });
    } else if (result === 'locked') {
      showToast({ emoji: '🔒', title: 'Сначала купите вещь', text: 'В «Мой мир» ставим только купленное' });
    }
  };

  /** Картинка вещи: техника — ToyArt, наряд — маскот БУКа в этом наряде. */
  const art = (item: ShopItem, size: number) =>
    item.kind === 'toy' ? (
      <ToyArt id={item.id} size={size} tuning={tuning} />
    ) : (
      <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={size} />
    );

  /** Категория сцены: техника по типу, наряды — отдельный мягкий фон. */
  const toneOf = (item: ShopItem): 'car' | 'ship' | 'phone' | 'outfit' => item.toy ?? 'outfit';

  return (
    <div className="screen world-screen">
      <h2 className="mb">🌍 Мой мир</h2>
      <p className="tiny muted mb">До {WORLD_SLOTS} вещей, которые вы выбрали сами. Они стоят здесь.</p>

      <div className="world-slots">
        {Array.from({ length: WORLD_SLOTS }, (_, index) => {
          const id = shown[index];
          const item = id ? ITEM_BY_ID[id] : undefined;
          if (!id || !item) {
            return (
              <button
                key={`empty-${index}`}
                type="button"
                className="world-slot empty"
                aria-label={`Пустое место ${index + 1}. Выбрать вещь`}
                onClick={() => setPicking(true)}
              >
                <span className="world-slot-plus" aria-hidden="true">＋</span>
                <small>Пустое место {index + 1}</small>
              </button>
            );
          }
          const tone = toneOf(item);
          return (
            <div key={id} className={`world-slot world-tone-${tone} tier-${rarityOf(item)}`}>
              <span className={`hangar-panel ${tone === 'outfit' ? 'world-panel-outfit' : `hangar-panel-${tone}`}`} aria-hidden="true">
                {tone !== 'outfit' && <BayDecor tone={tone} />}
              </span>
              <span className="world-slot-halo" aria-hidden="true" />
              <div className="world-slot-art">{art(item, 132)}</div>
              <span className="world-slot-plinth" aria-hidden="true" />
              <div className="world-slot-foot">
                <b className="world-slot-title">{item.title}</b>
                <RarityChip item={item} className="rarity-chip-mini" />
                <button type="button" className="btn sm ghost" onClick={() => tap(id)}>
                  Убрать
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!picking && (
        <button type="button" className="btn sm ghost wide" onClick={() => setPicking(true)}>
          Выбрать вещи ({world.length}/{WORLD_SLOTS})
        </button>
      )}

      {picking && (
        <section className="card world-picker" aria-label="Выбор вещей для Моего мира">
          <div className="row mb">
            <b className="grow">Выберите до {WORLD_SLOTS} · {world.length}/{WORLD_SLOTS}</b>
            <button type="button" className="btn sm" onClick={() => setPicking(false)}>
              Готово
            </button>
          </div>
          {ownedItems.length === 0 ? (
            <p className="tiny muted">Пока пусто. Купите вещь в БУКе, и она появится здесь.</p>
          ) : (
            <div className="world-pick">
              {ownedItems.map((item) => {
                const on = world.includes(item.id);
                const tone = toneOf(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`world-pick-item world-tone-${tone} tier-${rarityOf(item)}${on ? ' on' : ''}`}
                    aria-pressed={on}
                    aria-label={`${item.title}${on ? ' — в Моём мире. Убрать' : '. Поставить в Мой мир'}`}
                    onClick={() => tap(item.id)}
                  >
                    <span className="world-pick-art">{art(item, 84)}</span>
                    <span className="world-pick-title">{item.title}</span>
                    <RarityChip item={item} className="rarity-chip-mini" />
                    {on && <i aria-hidden="true">✓</i>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
