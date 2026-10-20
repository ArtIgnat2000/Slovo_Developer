import { useEffect } from 'react';
import { growthStage, isOwned, toysByShelf, type ShopItem, type ToyKind } from '../engine/shop';
import { haptic } from '../platform/haptics';
import { sfx } from '../platform/sound';
import { masteredCount, useActiveProfile, useApp, useLook } from '../state/store';
import { Mascot } from './Mascot';
import { BayDecor } from './TechScene';
import { ToyArt } from './ToyArt';

/**
 * «Ангар БУКа» — сцена коллекции техники из трёх частей (0.26.0):
 *  • полка для телефона — телефоны стоят на деревянных полках;
 *  • пристань для корабля — корабли у причала, море и волны;
 *  • гараж для машины — машины в гараже с лампами.
 *
 * Части идут всегда в этом порядке и всегда видны, даже пустые: в пустой
 * части написано, что туда встанет. Техника не рисуется на БУКе (правило
 * `showsOnBuk` в engine/shop.ts); БУК стоит на коврике рядом — хозяин коллекции.
 *
 * Любимая вещь (`equipped.toy`) отмечена звездой ★ в своей части и крупнее
 * остальных. Тап по вещи — звезда ставится или снимается. Отдельного большого
 * подиума сверху больше нет: ангар состоит только из трёх частей.
 *
 * Визуальный язык — тот же, что у витрины техники (TechScene, 0.19.0): арки с
 * декором BayDecor, бумажные бирки, коврик; наследует пять оформлений приложения.
 */

/** Части ангара: порядок и подписи фиксированы. */
const BAYS: { id: ToyKind; title: string; emoji: string; empty: string }[] = [
  { id: 'phone', title: 'Полка для телефона', emoji: '📱', empty: 'Телефон встанет на полку, как только вы его купите' },
  { id: 'ship', title: 'Пристань для корабля', emoji: '⛵', empty: 'Корабль причалит к пристани после покупки' },
  { id: 'car', title: 'Гараж для машины', emoji: '🚗', empty: 'Машина заедет в гараж после покупки' },
];

export function HangarScene({ onClose }: { onClose: () => void }) {
  const profile = useActiveProfile();
  const look = useLook();
  const toggleEquip = useApp((s) => s.toggleEquip);
  const showToast = useApp((s) => s.showToast);

  /** Escape закрывает ангар — как любой sheet в магазине. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!profile) return null;

  const owned = profile.shop?.owned ?? [];
  const tuning = profile.shop?.tuning;
  const favoriteId = look.toy && owned.includes(look.toy) ? look.toy : null;
  const growth = growthStage(masteredCount(profile));

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

        <div className="tiny muted mb">Тапни по вещи — она станет любимой ★</div>

        {BAYS.map(({ id, title, emoji, empty }) => {
          const items = toysByShelf(id).filter((item) => isOwned(owned, item.id));
          return (
            <section key={id} className={`hangar-zone hangar-tone-${id}`} aria-label={title}>
              <h3 className="music-shelf-title">
                <span aria-hidden="true">{emoji}</span> {title}
              </h3>
              <div className="hangar-stage">
                <span className={`hangar-panel hangar-panel-${id}`} aria-hidden="true">
                  <BayDecor tone={id} />
                </span>
                {items.length > 0 ? (
                  <div className="hangar-row">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`hangar-item${favoriteId === item.id ? ' star' : ''}`}
                        aria-label={itemAria(item)}
                        onClick={() => tapItem(item)}
                      >
                        <ToyArt id={item.id} size={favoriteId === item.id ? 84 : 58} tuning={tuning} />
                        <span className="hangar-item-plinth" aria-hidden="true" />
                        <span className="hangar-tag">
                          <b>{favoriteId === item.id ? `★ ${item.title}` : item.title}</b>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="hangar-empty tiny">{empty}</p>
                )}
              </div>
            </section>
          );
        })}

        {/* БУК — хозяин коллекции: стоит на коврике, техника НЕ на нём. */}
        <div className="hangar-buk" aria-hidden="true">
          <Mascot mood="happy" stage={growth.index} size={88} />
        </div>
        <div className="tiny muted hangar-note">БУК любуется коллекцией: техника стоит в ангаре, а не на нём</div>
      </div>
    </div>
  );
}
