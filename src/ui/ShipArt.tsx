import type { CSSProperties } from 'react';
import { ITEM_BY_ID } from '../engine/shop';
import { TOY_PLAY_COPY, ToyPlayFx, useToyPlay } from './toyPlay';

/**
 * Морская коллекция БУКа: полноцветные карандашные рисунки крупных судов.
 * Изображения — вырезанные WebP с прозрачным фоном, одинаковым холстом 720×480
 * и общей линией корпуса, поэтому одинаково читаются в карточке магазина,
 * ангаре и подробном просмотре.
 */
export const SHIP_ART: Record<string, { file: string; kind: string; note: string }> = {
  'ship-paper': {
    file: 'ship-yacht',
    kind: 'Морская яхта',
    note: 'Несколько палуб, панорамные окна и широкая прогулочная палуба',
  },
  'ship-sail': {
    file: 'ship-container',
    kind: 'Контейнеровоз',
    note: 'Высокие штабеля цветных контейнеров идут через океан между портами',
  },
  'ship-steam': {
    file: 'ship-tanker',
    kind: 'Супертанкер',
    note: 'Длинная палуба с трубами и оборудованием для перевозки нефти',
  },
  'ship-carrier': {
    file: 'ship-carrier',
    kind: 'Авианосец',
    note: 'Широкая полётная палуба и самолёты на борту',
  },
};

export function hasShipArt(id: string): boolean {
  return id in SHIP_ART;
}

export function shipKind(id: string): string | null {
  return SHIP_ART[id]?.kind ?? null;
}

export function shipNote(id: string): string | null {
  return SHIP_ART[id]?.note ?? null;
}

export function shipAlt(id: string, fallback = ''): string {
  const art = SHIP_ART[id];
  if (!art) return fallback;
  return `${fallback || art.kind} — ${art.kind.toLowerCase()}`;
}

export function shipArtUrl(id: string): string | null {
  if (!hasShipArt(id)) return null;
  return `${import.meta.env.BASE_URL}ships/${SHIP_ART[id].file}.webp`;
}

/** Рисунок судна. Цветной тюнинг накладывается на изображение, не заменяя штриховку. */
export function ShipArt({
  id,
  tint,
  alt,
  className,
  interactive = false,
}: {
  id: string;
  tint?: string | null;
  /** Пустая строка — декоративное изображение, когда карточка уже подписана. */
  alt?: string;
  className?: string;
  /** По нажатию корабль качается на волнах; только вне других кнопок. */
  interactive?: boolean;
}) {
  const { run, playing, play, onAnimationEnd } = useToyPlay();
  const src = shipArtUrl(id);
  if (!src) return null;
  const style = tint
    ? ({
        '--ship-tint': tint,
        '--ship-mask': `url("${src}")`,
      } as unknown as CSSProperties)
    : undefined;
  const cls = `ship-art${className ? ` ${className}` : ''}`;
  const picture = (
    <>
      <img src={src} width={720} height={480} alt={alt ?? ''} draggable={false} decoding="async" loading="lazy" />
      {tint && <span className="ship-art-wash" aria-hidden="true" />}
    </>
  );
  if (!interactive) {
    return (
      <span className={cls} style={style}>
        {picture}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${cls} toy-play toy-play--ship${playing ? ' is-playing' : ''}`}
      style={style}
      aria-label={`${ITEM_BY_ID[id]?.title ?? SHIP_ART[id].kind}: ${TOY_PLAY_COPY.ship.verb}`}
      title={TOY_PLAY_COPY.ship.title}
      onClick={(event) => { event.stopPropagation(); play(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="toy-play-anim" key={run} onAnimationEnd={onAnimationEnd}>
        {picture}
      </span>
      <ToyPlayFx kind="ship" />
    </button>
  );
}
