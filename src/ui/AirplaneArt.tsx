import type { CSSProperties } from 'react';
import { ITEM_BY_ID } from '../engine/shop';
import { TOY_PLAY_COPY, ToyPlayFx, useToyPlay } from './toyPlay';

export const AIRPLANE_IDS = [
  'plane-swift',
  'plane-atomic-base',
  'plane-electron-base',
  'plane-arctic-base',
  'plane-moon-base',
] as const;

const AIRPLANE_FILES: Record<string, string> = {
  'plane-swift': 'plane-swift.webp',
  'plane-atomic-base': 'plane-atomic-base.webp',
  'plane-electron-base': 'plane-electron-base.webp',
  'plane-arctic-base': 'plane-arctic-base.webp',
  'plane-moon-base': 'plane-moon-base.webp',
};

export function hasAirplaneArt(id: string): boolean {
  return id in AIRPLANE_FILES;
}

/** Individually illustrated aircraft with distinct silhouettes and liveries. */
export function AirplaneArt({
  id,
  size = 96,
  className,
  alt,
  colors,
  interactive = false,
}: {
  id: string;
  size?: number;
  className?: string;
  alt?: string;
  colors?: [string, string, string] | null;
  /** По нажатию самолёт делает петлю; только вне других кнопок. */
  interactive?: boolean;
}) {
  const { run, playing, play, onAnimationEnd } = useToyPlay();
  const file = AIRPLANE_FILES[id];
  if (!file) return null;

  const src = `${import.meta.env.BASE_URL}planes/${file}`;
  const style = {
    '--airplane-size': size,
    '--airplane-mask': `url("${src}")`,
    ...(colors ? { '--airplane-tint': colors[0] } : {}),
  } as CSSProperties;
  const cls = `airplane-art${className ? ` ${className}` : ''}`;
  const picture = (
    <>
      <img src={src} alt="" aria-hidden="true" draggable="false" decoding="async" />
      {colors && <span className="airplane-art-wash" aria-hidden="true" />}
    </>
  );

  if (!interactive) {
    return (
      <span
        className={cls}
        data-airplane-id={id}
        style={style}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : 'true'}
      >
        {picture}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${cls} toy-play toy-play--plane${playing ? ' is-playing' : ''}`}
      data-airplane-id={id}
      style={style}
      aria-label={`${ITEM_BY_ID[id]?.title ?? alt ?? 'Самолёт'}: ${TOY_PLAY_COPY.plane.verb}`}
      title={TOY_PLAY_COPY.plane.title}
      onClick={(event) => { event.stopPropagation(); play(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="toy-play-anim" key={run} onAnimationEnd={onAnimationEnd}>
        {picture}
      </span>
      <ToyPlayFx kind="plane" />
    </button>
  );
}
