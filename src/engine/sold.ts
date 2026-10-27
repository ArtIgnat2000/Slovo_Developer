/**
 * Единые ключи проданных товаров каталога.
 *
 * Ключ всегда содержит пространство имён (`track:easy-lemon`,
 * `theme:classic`, `tint:scarf:red`): так одинаковые короткие id разных
 * разделов не конфликтуют. Список лежит в профиле рядом с покупками —
 * иначе «всё открыто» вернуло бы проданную вещь при следующем запуске.
 */

export interface SoldCarrier {
  sold?: unknown;
}

/** Пространство имён + id товара. Для красок id содержит `вещь:оттенок`. */
export function catalogKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/** Ключ оттенка вещи или костюма. Базовый цвет тоже можно продать. */
export function tintKey(targetId: string, tintId: string): string {
  return catalogKey('tint', `${targetId}:${tintId}`);
}

/** Санитайзер старых/чужих записей: оставляем только непустые строковые ключи. */
export function normalizeSold(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.includes(':')),
  )];
}

/** Продан ли конкретный товар профиля. */
export function isSold(carrier: SoldCarrier | null | undefined, key: string): boolean {
  const sold = carrier?.sold;
  return Array.isArray(sold) && sold.includes(key);
}

/** Добавить ключи в список проданного, не создавая дубликаты. */
export function withSold<T extends { sold?: string[] }>(carrier: T, keys: string[]): T {
  const sold = normalizeSold(carrier.sold);
  const next = [...sold];
  for (const key of keys) if (!next.includes(key)) next.push(key);
  return next.length === sold.length ? carrier : { ...carrier, sold: next };
}

/** Убрать ключи из списка проданного — выкуп товара. */
export function withoutSold<T extends { sold?: string[] }>(carrier: T, keys: string[]): T {
  const sold = normalizeSold(carrier.sold);
  const next = sold.filter((key) => !keys.includes(key));
  return next.length === sold.length ? carrier : { ...carrier, sold: next };
}
