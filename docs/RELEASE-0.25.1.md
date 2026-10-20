# Релиз 0.25.1 — публикация сборки на GitHub Pages

## Что изменилось

- На GitHub Pages у репозитория была включена сборка «legacy» из корня ветки `main`.
  Поэтому сайт отдавал исходный `index.html` с `/src/main.tsx`, и браузер не мог
  загрузить модуль (MIME `text/html`). Workflow `Deploy to GitHub Pages` при этом
  падал на шаге `deploy-pages`.
- Workflow теперь переводит Pages в режим `workflow` (если он стоит в `legacy`).
- Сборка для Pages получает базовый путь `/<имя репозитория>/` через `VITE_BASE`,
  поэтому ассеты открываются по адресу `https://artignat2000.github.io/Slovo_Developer/`.
- Версия поднята до 0.25.1 в `package.json` и `package-lock.json`.

Код игры не меняется.

## Проверки

`release:check` относительно `main`, `npm run build` с `VITE_BASE=/Slovo_Developer/`
(ассеты в `/Slovo_Developer/assets/`, ссылок на `/slovo2/` нет), YAML workflow валиден.
