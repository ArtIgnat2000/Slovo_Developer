import { useEffect, useState } from 'react';
import { ITEM_BY_ID, growthStage, isOwned, rarityOf, toysByShelf, type ShopItem, type ToyKind } from '../engine/shop';
import { haptic } from '../platform/haptics';
import { sfx } from '../platform/sound';
import { masteredCount, useActiveProfile, useApp, useLook } from '../state/store';
import { Mascot } from './Mascot';
import { RarityChip } from './RarityChip';
import { BayDecor } from './TechScene';
import { ToyArt } from './ToyArt';

/**
 * «Ангар БУКа» — одна большая картинка и выбор части под ней (0.26.0):
 *  • сверху — большая сцена выбранной части: полка для телефона, пристань для
 *    корабля или гараж для машины; вещи этой части стоят крупно;
 *  • под сценой — выбор части (переключатель, как в магазине), у каждой
 *    части видно, сколько вещей в ней стоит.
 *
 * Пустая часть на сцене подсказывает, что туда встанет после покупки.
 * Любимая вещь (`equipped.toy`) отмечена звездой ★ и крупнее остальных; тап по
 * вещи ставит или снимает звезду. Техника не рисуется на БУКе (правило
 * `showsOnBuk` в engine/shop.ts), БУК стоит на коврике рядом.
 *
 * Визуальный язык — тот же, что у витрины техники (TechScene, 0.19.0): декор
 * BayDecor, бумажные бирки, коврик; наследует пять оформлений приложения.
 */

/** Части ангара: порядок и подписи фиксированы. */
const BAYS: { id: ToyKind; title: string; short: string; emoji: string; empty: string }[] = [
  { id: 'phone', title: 'Полка для телефона', short: 'Полка', emoji: '📱', empty: 'Телефон встанет на полку, как только вы его купите' },
  { id: 'ship', title: 'Пристань для корабля', short: 'Пристань', emoji: '⛵', empty: 'Корабль причалит к пристани после покупки' },
  { id: 'car', title: 'Гараж для машины', short: 'Гараж', emoji: '🚗', empty: 'Машина заедет в гараж после покупки' },
  { id: 'plane', title: 'Ангар для самолёта', short: 'Самолёты', emoji: '✈️', empty: 'Самолёт встанет в ангар после покупки' },
];

export function HangarScene({ onClose }: { onClose: () => void }) {
  const profile = useActiveProfile();
  const look = useLook();
  const toggleEquip = useApp((s) => s.toggleEquip);
  const showToast = useApp((s) => s.showToast);

  const owned = profile?.shop?.owned ?? [];
  const tuning = profile?.shop?.tuning;
  const favoriteId = look.toy && owned.includes(look.toy) ? look.toy : null;
  const growth = growthStage(masteredCount(profile));

  /** Какая часть открыта: по умолчанию — часть любимой вещи, иначе первая непустая. */
  const [bay, setBay] = useState<ToyKind>(() => {
    const favoriteToy = favoriteId ? ITEM_BY_ID[favoriteId]?.toy : undefined;
    if (favoriteToy) return favoriteToy;
    const filled = BAYS.find(({ id }) => toysByShelf(id).some((item) => isOwned(owned, item.id)));
    return filled?.id ?? 'phone';
  });

  /** Escape закрывает ангар — как любой sheet в магазине. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!profile) return null;

  const current = BAYS.find((b) => b.id === bay) ?? BAYS[0];
  const items = toysByShelf(current.id).filter((item) => isOwned(owned, item.id));

  /** Тап по вещи: звезда ставится или снимается. */
  const tapItem = (item: ShopItem) => {
    sfx.tap();
    haptic.tap();
    const wasFavorite = favoriteId === item.id;
    toggleEquip(item.id);
    showToast(
      wasFavorite
        ? {
            emoji: item.emoji ?? '🚗',
            title: `«${item.title}» — без звезды`,
            text: 'Вещь стоит в своей части ангара',
          }
        : {
            emoji: item.emoji ?? '🚗',
            title: `«${item.title}» — со звездой ★`,
            text: 'Теперь она любимая в ангаре',
          },
    );
  };

  const itemAria = (item: ShopItem) =>
    favoriteId === item.id
      ? `${item.title} — любимая, с звездой. Снять звезду`
      : `${item.title}. Поставить звезду`;

  return (
    <div className="hangar-veil" role="presentation" onClick={onClose}>
      <div
        className="hangar"
        role="dialog"
        aria-modal="true"
        aria-label="Ангар БУКа"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hangar-grab" aria-hidden="true" />
        <div className="row mb">
          <h2 className="grow" style={{ margin: 0 }}>
            🚗 Ангар БУКа
          </h2>
          <button type="button" className="lesson-exit" aria-label="Закрыть ангар" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Одна большая картинка: выбранная часть ангара целиком. */}
        <section className={`hangar-scene hangar-tone-${current.id}`} aria-label={current.title}>
          <h3 className="hangar-scene-title">
            <span aria-hidden="true">{current.emoji}</span> {current.title}
          </h3>
          <div className="hangar-stage">
            <span className={`hangar-panel hangar-panel-${current.id}`} aria-hidden="true">
              <BayDecor tone={current.id} />
            </span>
            {items.length > 0 ? (
              <div className="hangar-row">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`hangar-item tier-${rarityOf(item)}${favoriteId === item.id ? ' star' : ''}`}
                    aria-label={itemAria(item)}
                    onClick={() => tapItem(item)}
                  >
                    <ToyArt id={item.id} size={favoriteId === item.id ? 120 : 92} tuning={tuning} />
                    <span className="hangar-item-plinth" aria-hidden="true" />
                    <span className="hangar-tag">
                      <b>{favoriteId === item.id ? `★ ${item.title}` : item.title}</b>
                      <RarityChip item={item} className="rarity-chip-mini" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="hangar-empty tiny">{current.empty}</p>
            )}
          </div>
        </section>

        {/* Выбор части под картинкой: три отсека, у каждого — число вещей. */}
        <div className="shop-seg hangar-bays" role="tablist" aria-label="Часть ангара">
          {BAYS.map(({ id, short, emoji }) => {
            const count = toysByShelf(id).filter((item) => isOwned(owned, item.id)).length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={bay === id}
                className={bay === id ? 'on' : ''}
                onClick={() => {
                  sfx.tap();
                  setBay(id);
                }}
              >
                {emoji} {short} · {count}
              </button>
            );
          })}
        </div>

        {/* БУК — хозяин коллекции: стоит на коврике, техника НЕ на нём. */}
        <div className="hangar-buk" aria-hidden="true">
          <Mascot mood="happy" stage={growth.index} size={88} />
        </div>
        <div className="tiny muted hangar-note">Тапни по вещи — она станет любимой ★. БУК любуется коллекцией</div>
      </div>
    </div>
  );
}
