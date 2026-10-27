// Стенд «вау-алмаза» из slovo2 0.68.0, адаптированный к Slovo_Developer.
// Проверяем именно то, что дети просили: свечение, объём, искры и уникальные
// градиенты у каждого кристалла на экране. Полный набор из 20 иконок
// перенесён, но остальные эмодзи в контенте и тостах форка не трогаем.
import './setup';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Gem, ICON_NAMES, Icon } from '../src/ui/Icon';
import { check, sleep } from './ui-helpers';

const read = (file: string) => readFileSync(file, 'utf8');

async function render(node: ReturnType<typeof createElement>): Promise<HTMLDivElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(node);
  await sleep(30);
  return host;
}

export async function runIconChecks(): Promise<void> {
  check('иконки: перенесён весь набор из 20 знаков', ICON_NAMES.length === 20, `сейчас ${ICON_NAMES.length}`);

  const host = await render(
    createElement('div', null, createElement(Icon, { name: 'crystal', size: 26 }), createElement(Gem, { value: 128, size: 22 })),
  );
  const html = host.innerHTML;

  check('вау-алмаз: у камня есть ореол свечения', html.includes('radialGradient') && html.includes('-glow'), html.slice(0, 200));
  check('вау-алмаз: камень залит объёмным градиентом', html.includes('linearGradient') && html.includes('-body'), '');
  check('вау-алмаз: у кристалла две мерцающие искры', (html.match(/ic-spark/g) ?? []).length >= 4, '');
  check('вау-алмаз: декоративная иконка скрыта от скринридера', html.includes('aria-hidden="true"'), '');
  check('вау-алмаз: число и камень — одна группа Gem', html.includes('gem-amount') && html.includes('128'), '');

  const manyHost = await render(
    createElement(
      'div',
      null,
      ...Array.from({ length: 3 }, (_, i) => createElement(Icon, { key: i, name: 'crystal', size: 24 })),
    ),
  );
  const many = manyHost.innerHTML;
  const ids = Array.from(many.matchAll(/id="([^"]+)-glow"/g)).map((m) => m[1]);
  check('вау-алмаз: у трёх кристаллов разные id градиентов', ids.length === 3 && new Set(ids).size === 3, ids.join(','));
  check(
    'вау-алмаз: нет битых ссылок на градиенты',
    ids.every((id) => many.includes(`url(#${id}-glow)`) && many.includes(`url(#${id}-body)`)),
    '',
  );

  const css = read('src/styles/upstream-0.68.0.css');
  check(
    'вау-алмаз: «меньше движения» выключает мерцание',
    css.includes('prefers-reduced-motion: reduce') && /\.ico \.ic-spark \{\s*animation: none;/.test(css),
    '',
  );

  const home = read('src/ui/screens/HomeScreen.tsx');
  const shop = read('src/ui/screens/ShopScreen.tsx');
  const quests = read('src/ui/DailyQuests.tsx');
  check('новый кристалл стоит в шапке, магазине и наградах', home.includes('<Gem') && shop.includes('<Gem') && quests.includes('<Gem'), '');
  check('меню ☰ использует SVG-иконку, а не эмодзи-гамбургер', home.includes('name="menu"') && home.includes('data-menu-trigger'), '');
  check('строка версии есть в меню ☰', home.includes('data-menu-version') && home.includes('VITE_APP_VERSION'), '');
}
