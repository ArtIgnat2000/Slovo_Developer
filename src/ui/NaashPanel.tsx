import { useEffect, useState } from 'react';
import { SCHOOL, SCHOOL_IDEAS, type SchoolIdea } from '../engine/naash';
import { SERIES_ITEMS, type ShopItem } from '../engine/shop';
import { ShowcaseGrid } from './ShowcaseGrid';
import { sfx } from '../platform/sound';

/**
 * Раздел «НААШ» в магазине БУКа (0.74.0, docs/proposals/naash-shop.md).
 *
 * Школьный уголок, а не девятая полка товаров: две части на одном экране.
 *  • «Форма и вещи БУКа» — четыре наряда и две игровые школьные вещи линейки `series: 'naash'`;
 *    карточки те же, что на остальных полках (их рисует магазин и передаёт
 *    сюда готовыми), поэтому покупка, «Мечты», перекраска и сдача работают
 *    без отдельного каталога.
 *  • «Полка идей» — десять картинок серии мерча; кружка и рюкзак живут в каталоге товаров. Тап открывает снимок
 *    крупно. Цен нет, «в мечты» нет: настоящих вещей школа не продаёт,
 *    и обещать ребёнку покупку нельзя.
 *
 * Картинки лежат в `public/naash/` и намеренно НЕ в precache PWA: установка
 * приложения не тяжелеет, а плитки кэшируются при первом просмотре
 * (vite.config.ts, кэш `slovo2-naash`).
 */

/** Фирменный знак школы: подключаем канон из docs/naash, не перерисовываем его в упрощённом SVG. */
function SchoolSign({ size = 40 }: { size?: number }) {
  return (
    <img
      className="naash-sign"
      src={`${import.meta.env.BASE_URL}naash/mark-color.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

export function NaashPanel({ renderItem }: { renderItem: (item: ShopItem) => React.ReactNode }) {
  const [open, setOpen] = useState<SchoolIdea | null>(null);
  const items = SERIES_ITEMS('naash');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <section className="mt naash" aria-label="Школа НААШ">
      {/* Шапка уголка: знак, название и честная строка про игру */}
      <div className="naash-head">
        <SchoolSign size={40} />
        <div className="grow">
          <h2 className="naash-title">{SCHOOL.title}</h2>
          <div className="tiny muted">{SCHOOL.lead}</div>
        </div>
      </div>

      <h3 className="music-shelf-title">{SCHOOL.formTitle}</h3>
      <div className="tiny muted mb">{SCHOOL.formLead}</div>
      <ShowcaseGrid>{items.slice().sort((a, b) => a.price - b.price).map(renderItem)}</ShowcaseGrid>

      <h3 className="music-shelf-title naash-ideas-title">{SCHOOL.ideasTitle}</h3>
      <div className="tiny muted mb">{SCHOOL.ideasLead}</div>
      <div className="naash-grid">
        {SCHOOL_IDEAS.map((idea) => (
          <button
            key={idea.file}
            type="button"
            className="naash-tile"
            onClick={() => {
              sfx.tap();
              setOpen(idea);
            }}
            aria-label={`${idea.name} — открыть крупно`}
          >
            <img
              src={`${import.meta.env.BASE_URL}naash/${idea.file}.webp`}
              width={600}
              height={600}
              loading="lazy"
              decoding="async"
              alt=""
              draggable={false}
            />
            <span className="naash-tile-name">{idea.name}</span>
          </button>
        ))}
      </div>
      <p className="tiny muted naash-honest">{SCHOOL.honest}</p>

      {open && (
        <div className="naash-veil" role="presentation" onClick={() => setOpen(null)}>
          <div
            className="naash-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={open.name}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`${import.meta.env.BASE_URL}naash/${open.file}.webp`}
              width={600}
              height={600}
              alt={open.name}
              decoding="async"
              draggable={false}
            />
            <div className="naash-sheet-title">{open.name}</div>
            <div className="tiny muted">{open.note}</div>
            <div className="tiny naash-honest">{SCHOOL.honest}</div>
            <button type="button" className="btn primary wide mt" onClick={() => setOpen(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
