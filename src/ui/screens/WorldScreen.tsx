import { useState } from 'react';
import { ITEM_BY_ID, growthStage, isOwned, SHOP_ITEMS, type ShopItem } from '../../engine/shop';
import { normalizeWorld, WORLD_SLOTS } from '../../engine/world';
import { haptic } from '../../platform/haptics';
import { sfx } from '../../platform/sound';
import { masteredCount, useActiveProfile, useApp } from '../../state/store';
import { Mascot } from '../Mascot';
import { ToyArt } from '../ToyArt';

/**
 * «Мой мир» (0.26.0): вкладка с тремя вещами, которые ребёнок выбрал сам.
 * Слоты сверху — то, что уже стоит в мире; «Выбрать» открывает список купленных
 * вещей. Нажатие на вещь ставит её в мир или убирает. Техника рисуется
 * ToyArt, наряды — маскотом БУКа в этом наряде.
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
  const ownedItems = SHOP_ITEMS.filter((item) => isOwned(owned, item.id));

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

  const art = (item: ShopItem, size: number) =>
    item.kind === 'toy' ? (
      <ToyArt id={item.id} size={size} tuning={tuning} />
    ) : (
      <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={size} />
    );

  return (
    <div className="screen world-screen">
      <h2 className="mb">🌍 Мой мир</h2>
      <p className="tiny muted mb">До {WORLD_SLOTS} вещей, которые вы выбрали сами. Они стоят здесь.</p>

      <div className="world-slots">
        {Array.from({ length: WORLD_SLOTS }, (_, index) => {
          const id = world[index];
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
                <small>Пустое место</small>
              </button>
            );
          }
          return (
            <div key={id} className="world-slot">
              <div className="world-slot-art">{art(item, 84)}</div>
              <b className="world-slot-title">{item.title}</b>
              <button type="button" className="btn sm ghost" onClick={() => tap(id)}>
                Убрать
              </button>
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
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`world-pick-item${on ? ' on' : ''}`}
                    aria-pressed={on}
                    aria-label={`${item.title}${on ? ' — в Моём мире. Убрать' : '. Поставить в Мой мир'}`}
                    onClick={() => tap(item.id)}
                  >
                    <span className="world-pick-art">{art(item, 56)}</span>
                    <span className="world-pick-title">{item.title}</span>
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
