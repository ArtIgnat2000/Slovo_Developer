import type { CSSProperties } from 'react';
import type { ThemeStyleOption } from '../engine/theme-styles';

export function BackgroundThemeCard({
  theme,
  selected,
  onSelect,
  sell,
}: {
  theme: ThemeStyleOption;
  selected: boolean;
  onSelect: () => void;
  /** Продажа фона: подпись уже содержит сумму возврата. */
  sell?: { label: string; onClick: () => void; dataKey: string };
}) {
  const previewStyle = {
    '--preview-light': theme.preview.light,
    '--preview-dark': theme.preview.dark,
    '--preview-accent': theme.preview.accent,
    '--preview-secondary': theme.preview.secondary,
  } as CSSProperties;

  return (
    <article data-theme-style={theme.id} className={`background-theme-card${selected ? ' selected' : ''}`}>
      <div className="background-theme-preview" style={previewStyle} aria-hidden="true">
        <div className="background-theme-pane light">
          <span className="background-theme-mini-card" />
        </div>
        <div className="background-theme-pane dark">
          <span className="background-theme-mini-card" />
        </div>
      </div>
      <div className="background-theme-title">
        <span aria-hidden="true">{theme.emoji}</span>
        <span>{theme.title}</span>
      </div>
      <p className="background-theme-desc">{theme.description}</p>
      <span className="background-theme-label">{selected ? 'Сейчас выбрана' : 'Бесплатно'}</span>
      <button
        type="button"
        className={`btn wide ${selected ? 'green' : 'primary'}`}
        aria-label={selected ? `Сейчас выбрана тема ${theme.title}` : `Выбрать тему ${theme.title}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {selected ? 'Выбрана ✓' : 'Применить'}
      </button>
      {sell && (
        <button
          type="button"
          className="btn sm wide ghost mt"
          data-sell={sell.dataKey}
          onClick={sell.onClick}
        >
          {sell.label}
        </button>
      )}
    </article>
  );
}
