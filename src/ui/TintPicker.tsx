import { TINT_PRICE, currentTint, tintChoices, tintSwatchColors, type TintOption } from '../engine/tints';
import type { ShopTuning } from '../types';

interface Props {
  /** Что красим: у аксессуара «Цвет», у костюма «Акцент» */
  caption: string;
  /** id вещи магазина или костюма — по нему движок находит палитру */
  targetId: string;
  /** Название вещи: его читает скринридер */
  title: string;
  tuning: ShopTuning | undefined;
  /** Ключи проданных оттенков: их не показываем в палитре. */
  soldKeys?: string[];
  /** Тап по оттенку: `unlocked` — цена 0, значит можно менять сразу, без диалога */
  onPick: (tint: TintOption, unlocked: boolean) => void;
  /** Данные кнопки продажи для уже открытого оттенка, включая базовый. */
  sale?: (tintId: string) => { key: string; label: string } | null;
  onSell?: (tintId: string) => void;
}

/**
 * Палитра оттенков одной вещи: базовый плюс три за кристаллы.
 *
 * Кружок 44×44 (зона касания по WCAG 2.5.5), у выбранного — кольцо и ✓, у
 * закрытого — пунктир и «💎1». Оттенок не передаётся одним цветом: градиент
 * показывает и «глубокий» тон (плащ костюма, тень аксессуара), а название
 * всегда есть в aria-label — цвет не единственный носитель смысла (WCAG 1.4.1).
 */
export function TintPicker({ caption, targetId, title, tuning, soldKeys = [], onPick, sale, onSell }: Props) {
  const current = currentTint(tuning, targetId);
  const choices = tintChoices(tuning, targetId, soldKeys);
  if (!choices.length) return null;
  return (
    <div className="tint-panel">
      <div className="tiny muted">
        {caption}: {current?.title.toLowerCase()}
      </div>
      <div className="tint-row" role="group" aria-label={`${caption}: ${title}`}>
        {choices.map((choice) => {
          const [main, deep] = tintSwatchColors(targetId, choice.tint.id);
          const sellInfo = choice.unlocked && sale
            ? sale(choice.tint.id)
            : null;
          return (
            <div className="tint-cell" key={choice.tint.id}>
              <button
                className={`tint-swatch${choice.selected ? ' on' : ''}${choice.unlocked ? '' : ' paid'}`}
                style={{ background: `linear-gradient(135deg, ${main} 0 55%, ${deep} 55% 100%)` }}
                aria-pressed={choice.selected}
                aria-label={
                  choice.unlocked
                    ? `${choice.tint.title}${choice.selected ? ', выбран' : ', открыт'}`
                    : `${choice.tint.title}, стоит ${TINT_PRICE} 💎`
                }
                onClick={() => onPick(choice.tint, choice.unlocked)}
              >
                {choice.unlocked ? '' : `💎${TINT_PRICE}`}
              </button>
              {sellInfo && (
                <button
                  type="button"
                  className="tint-sell"
                  data-sell={sellInfo.key}
                  aria-label={`Продать цвет ${choice.tint.title}: ${sellInfo.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSell?.(choice.tint.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
