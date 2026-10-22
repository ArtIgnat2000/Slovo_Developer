import type { CSSProperties } from 'react';

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
}: {
  id: string;
  size?: number;
  className?: string;
  alt?: string;
  colors?: [string, string, string] | null;
}) {
  const file = AIRPLANE_FILES[id];
  if (!file) return null;

  const src = `${import.meta.env.BASE_URL}planes/${file}`;
  const style = {
    '--airplane-size': size,
    '--airplane-mask': `url("${src}")`,
    ...(colors ? { '--airplane-tint': colors[0] } : {}),
  } as CSSProperties;

  return (
    <span
      className={`airplane-art${className ? ` ${className}` : ''}`}
      data-airplane-id={id}
      style={style}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : 'true'}
    >
      <img src={src} alt="" aria-hidden="true" draggable="false" decoding="async" />
      {colors && <span className="airplane-art-wash" aria-hidden="true" />}
    </span>
  );
}
