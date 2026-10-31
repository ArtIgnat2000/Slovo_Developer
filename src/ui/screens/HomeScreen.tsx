import { useEffect, useState } from 'react';
import { scheduleWordImages } from '../../platform/word-images';
import {
  AVAILABLE_CLASSES,
  CLASS_META,
  LESSONS_BY_GRADE,
  WORDS,
  availableClass,
} from '../../content/words';
import { dayKey, useActiveProfile, useApp } from '../../state/store';
import { Crowns } from '../Bits';
import { ClassSheet } from '../ClassSheet';
import { DailyQuests } from '../DailyQuests';
import { DailyQuestStrip } from '../DailyQuestStrip';
import { drillLimit, hardWords, listStats } from '../../engine/word-lists';
import { Icon, Gem } from '../Icon';
import { InviteFriend } from '../InviteFriend';
import { WeeklyRewards } from '../WeeklyRewards';
import { classProgress, nextClass } from '../../engine/classes';
import { nextStartAction } from '../../engine/next-start';
import { useHomeIntent } from '../../state/home-intent';
import {
  allQuestsDone,
  bonusChestsReady,
  claimableQuests,
  dailyChestClaimed,
  dayMetrics,
  planOf,
  plannedQuests,
  plural,
  type QuestKind,
} from '../../engine/quests';
import type { Profile } from '../../types';

interface Props {
  onStartLesson: (lessonId: string) => void;
  onOpenProfiles: () => void;
  /** Открыть раздел родителей за взрослой проверкой для добровольной поддержки. */
  onOpenSupport: () => void;
  /** «Пора повторить» — отдельный режим тренировки, id урока не нужен */
  onStartReview: () => void;
  /** Меню ведёт прямо в «Мои покупки» или «Мой мир» внутри БУКа. */
  onOpenShop: (view: 'vitrina' | 'wardrobe' | 'world') => void;
  /** Списки слов к контрольной (0.58.0): тренировка, полный контроль, ошибки. */
  onStartList: (listId: string, mode?: 'train' | 'check' | 'errors') => void;
}

/**
 * Сколько наград ждёт в листе (0.32.0): число у «Наград» в меню ☰ (0.33.0) —
 * обещание, поэтому считаем ровно те действия, которые ребёнок там найдёт, —
 * «Забрать» у задания, «Открыть сундук БУКа» и «Открыть бонусный сундук».
 *
 * Недельные награды не считаем: они начисляются сами в `finishLesson`
 * (state/store.ts), в листе только показывается прогресс — забирать нечего.
 * Иначе бейдж звал бы за наградой, которой там нет.
 */
function rewardsCount(profile: Profile): number {
  const day = dayKey();
  const plan = planOf(profile, day);
  const st = profile.daily && profile.daily.day === day ? profile.daily : null;
  const metrics = dayMetrics(profile.days[day]);
  let count = claimableQuests(plannedQuests(plan), metrics, st?.claimed ?? [], day).length;
  if (allQuestsDone(plan, metrics) && !dailyChestClaimed(st ?? undefined)) count += 1;
  count += bonusChestsReady(metrics.lessons, st?.bonusChestsClaimed ?? 0);
  return count;
}

export function HomeScreen({ onStartLesson, onOpenProfiles, onOpenSupport, onStartReview, onOpenShop, onStartList }: Props) {
  const profile = useActiveProfile();
  const setActiveClass = useApp((s) => s.setActiveClass);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  /**
   * Разовая команда навигатора БУКа (0.85.0): дверь «🎁 Задания» переключила
   * вкладку на главную и просила открыть лист заданий. Команда гаснет сразу,
   * чтобы не открываться заново при каждой перерисовке экрана.
   */
  const intent = useHomeIntent((s) => s.intent);
  const intentNonce = useHomeIntent((s) => s.nonce);
  useEffect(() => {
    if (intent !== 'rewards') return;
    setRewardsOpen(true);
    useHomeIntent.getState().clear();
  }, [intentNonce, intent]);
  /** «Позови друга» — 0.32.1: ссылка должна быть в один тап с первого экрана. */
  const [inviteOpen, setInviteOpen] = useState(false);
  /** Меню ☰: награды, покупки, мир, смена ученика, поддержка и QR/ссылка для друзей. */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Лист класса (0.33.0): вход — строкой в меню, а не пилюлей над героем. */
  const [classOpen, setClassOpen] = useState(false);
  /**
   * Путь (0.67.0): по умолчанию видно «Дальше» — три ближайших урока, а весь
   * путь раскрывается по кнопке. Раньше на телефоне под героем лежали все
   * 13–16 уроков (два с лишним экрана прокрутки), и «сегодня» терялось.
   */
  const [pathOpen, setPathOpen] = useState(false);
  // Программа активного класса: «Мой путь» и герой показывают только её.
  // Класс — свойство профиля, поэтому у каждого ученика свой путь.
  const grade = availableClass(profile?.activeClass ?? 2);
  const classLessons = LESSONS_BY_GRADE[grade];
  const current =
    classLessons.find((l) => (profile?.lessons[l.id]?.level ?? 0) < 5) ??
    classLessons[classLessons.length - 1];
  // «Класс пройден» — все уроки программы закрыты (уровень 5). Следующий класс
  // берём из движка классов: там же это правило используют лист класса и отчёт.
  const classInfo = classProgress(profile, grade);
  const classDone = classInfo.complete;
  const nextGrade = nextClass(grade);
  useEffect(
    () => (current ? scheduleWordImages(WORDS.filter((w) => current.wordIds.includes(w.id))) : undefined),
    [current],
  );
  useEffect(() => {
    if (!rewardsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRewardsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rewardsOpen]);
  if (!profile) return null;

  /**
   * Запуск задания дня: «Повтори N слов» ведёт в режим повторения, остальные задания
   * выполняются в уроке — открываем текущий урок с карты пути.
   */
  const startQuest = (kind: QuestKind) => {
    setRewardsOpen(false);
    if (kind === 'review') onStartReview();
    else onStartLesson(current.id);
  };

  /**
   * Ближайшие уроки для свёрнутого пути: текущий и два следующих. Если
   * ребёнок уже в конце программы, показываем последние три — «дальше» не
   * должно оказаться пустым.
   */
  const currentIndex = Math.max(0, classLessons.findIndex((l) => l.id === current.id));
  const previewFrom = Math.min(currentIndex, Math.max(0, classLessons.length - 3));
  const previewLessons = classLessons.slice(previewFrom, previewFrom + 3);
  const visibleLessons = pathOpen ? classLessons : previewLessons;

  const currentDone = current.wordIds.filter((id) => (profile.words[id]?.s ?? 0) > 0).length;
  const rewards = rewardsCount(profile);
  // «Пора повторить» и ближайший урок считает движок (engine/next-start):
  // созревшие повторения первыми, иначе — первый непройденный урок класса.
  // Тот же расчёт стоит у двери «📖 Урок» навигатора БУКа, чтобы кнопки
  // «Начать» на главной и в дуге никогда не разъезжались.
  const next = nextStartAction(profile);
  const reviewDue = next.reviewDue;

  /** Escape закрывает меню, как любой лист в приложении. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openMenuSheet = (open: () => void) => {
    setMenuOpen(false);
    open();
  };

  const startHero = () => {
    if (reviewDue) onStartReview();
    else onStartLesson(next.lessonId ?? current.id);
  };

  /**
   * План на сегодня из списков к контрольной (0.90.0).
   *
   * Список — внешний дедлайн из школы, поэтому он живёт в плане рядом с уроком,
   * а не отдельной полкой над ним. Порядок — по срочности: сначала списки с
   * ошибками после контрольной, потом мало тренированные, потом новые.
   * Скрытые родителем списки в план не попадают вовсе.
   */
  const listPlan = (profile.lists ?? [])
    .filter((list) => !list.hidden)
    .map((list) => {
      const stats = listStats(list, profile.customWords ?? {});
      const trained = list.words.filter((id) => (profile.words?.[id]?.ok ?? 0) > 0).length;
      // «Трудные» — по всей истории заходов; запасной вариант — ошибки последней контрольной.
      const errors = hardWords(list, 20).length || (list.lastCheck?.wrong.length ?? 0);
      return { list, stats, trained, errors, perRun: drillLimit(profile, stats.total) };
    })
    .sort(
      (a, b) =>
        (b.errors > 0 ? b.errors : 0) - (a.errors > 0 ? a.errors : 0) ||
        a.trained / Math.max(1, a.stats.total) - b.trained / Math.max(1, b.stats.total) ||
        b.list.createdAt - a.list.createdAt,
    );
  // Больше двух списков план не показывает: это «сегодня», а не расписание.
  const todayLists = listPlan.slice(0, 2);
  const moreLists = Math.max(0, listPlan.length - todayLists.length);

  return (
    <div className="screen">
      {/* Шапка (0.33.0): три блока и два действия. 💎 — главный и единственный
          счётчик в строке: кристаллы ребёнок видит, тратит и понимает. 🔥 из
          шапки ушёл в меню — там у огонька есть слова, а не только цифра.
          ☰ заменил 🎁: в меню не только награды, но и покупки, мой мир, друг
          и смена ученика (docs/proposals/home-menu.md). */}
      <div className="topbar">
        <button
          type="button"
          className="profile-btn"
          title="Профили"
          aria-label={`Профиль: ${profile.name}. Сменить ученика`}
          onClick={onOpenProfiles}
        >
          <span className="avatar" aria-hidden="true">
            {profile.avatar}
          </span>
          <span className="topbar-name">{profile.name}</span>
        </button>

        <div className="grow" aria-hidden="true" />

        <div
          className="topbar-stat gems"
          role="img"
          data-stat="gems"
          aria-label={`Кристаллы: ${profile.gems}`}
        >
          {/* 0.54.0: кристалл — SVG-иконка, а не эмодзи: в 16–18 px эмодзи
              «плывёт» от шрифта к устройству, а иконка наследует цвет текста. */}
          <Gem value={profile.gems} size={26} />
        </div>

        <button
          type="button"
          className="menu-btn"
          data-menu-trigger
          aria-label="Меню: награды, покупки и другое"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" size={22} />
        </button>
      </div>

      {/* ── Блок «Сегодня» (0.90.0) ─────────────────────────────────────────
          Один блок = одно дело. Герой с «Начать ▶» стоит первым, а задания дня
          и списки к контрольной идут строками плана под ним: они объясняют,
          что ещё осталось, но не спорят с главным действием за палец.
          Разбор — docs/proposals/lessons-panel.md. */}
      <section className="home-today" aria-label="План на сегодня">

      {classDone && !reviewDue ? (
        <button
          type="button"
          className="home-hero mb"
          onClick={() => (nextGrade ? setActiveClass(nextGrade) : onStartReview())}
          aria-label={nextGrade ? `Перейти в ${CLASS_META[nextGrade].title}` : 'Повторить слова'}
        >
          <div className="home-hero-kicker">Класс пройден</div>
          <div className="home-hero-body">
            <span className="home-hero-emoji" aria-hidden="true">
              🎉
            </span>
            <span className="grow">
              <span className="home-hero-title">{CLASS_META[grade].title} пройден!</span>
              <span className="home-hero-meta">
                {classLessons.length} {plural(classLessons.length, 'урок', 'урока', 'уроков')} позади ·{' '}
                {classInfo.mastered} из {classInfo.words} {plural(classInfo.words, 'слово', 'слова', 'слов')} освоено
              </span>
            </span>
          </div>
          <span className="home-hero-cta">
            {nextGrade ? `${CLASS_META[nextGrade].title} ▶` : 'Повторить ▶'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="home-hero mb"
          onClick={startHero}
          aria-label={reviewDue ? 'Начать: Пора повторить' : `Начать: ${current.title}`}
        >
          <div className="home-hero-kicker">Сегодня</div>
          <div className="home-hero-body">
            <span className="home-hero-emoji" aria-hidden="true">
              {reviewDue ? '🔁' : current.emoji}
            </span>
            <span className="grow">
              <span className="home-hero-title">{reviewDue ? 'Пора повторить' : current.title}</span>
              <span className="home-hero-meta">
                {reviewDue
                  ? `${next.reviewCount} ${plural(next.reviewCount, 'слово готово', 'слова готовы', 'слов готовы')} забыться`
                  : `${currentDone} из ${current.wordIds.length} слов`}
              </span>
            </span>
          </div>
          <span className="home-hero-cta">Начать ▶</span>
        </button>
      )}

        <div className="today-steps">
          {/* Задания дня: одна строка вместо отдельного блока. Тап открывает
              лист наград — там «Забрать», сундук и подробности. */}
          <DailyQuestStrip onOpen={() => setRewardsOpen(true)} />

          {/* Списки к контрольной (0.90.0): шаг плана, а не полка над днём.
              Тап по строке — тренировка; 📋 — полная контрольная; 🔁 — только
              ошибки и только если они есть. */}
          {todayLists.map(({ list, stats, errors, perRun }) => (
            <div key={list.id} className="today-step today-list">
              <button
                type="button"
                className="today-step-main"
                data-list-card={list.id}
                aria-label={`Список «${list.title}», ${stats.total} слов. Начать тренировку`}
                onClick={() => onStartList(list.id, 'train')}
              >
                <span className="today-step-icon" aria-hidden="true">🏫</span>
                <span className="today-step-text">
                  <span className="today-step-title">{list.title}</span>
                  <span className="today-step-meta">
                    {stats.total} слов · тренировка {perRun}
                    {list.lastCheck ? ` · контрольная: ${list.lastCheck.correct} из ${list.lastCheck.total}` : ''}
                  </span>
                </span>
                <span className="today-step-go" aria-hidden="true">▶</span>
              </button>
              <button
                type="button"
                className="btn ghost sm today-step-side"
                data-list-check={list.id}
                aria-label={`Проверить все ${stats.total} слов списка «${list.title}»`}
                onClick={() => onStartList(list.id, 'check')}
              >
                📋
              </button>
              {errors > 0 && (
                <button
                  type="button"
                  className="btn ghost sm today-step-side"
                  data-list-errors={list.id}
                  aria-label={`Тренировать ошибки списка «${list.title}»`}
                  onClick={() => onStartList(list.id, 'errors')}
                >
                  🔁
                </button>
              )}
            </div>
          ))}

          {moreLists > 0 && (
            <p className="today-note">
              Ещё {moreLists} {plural(moreLists, 'список', 'списка', 'списков')} к контрольной — в разделе «Родителям»
            </p>
          )}
        </div>
      </section>

      {/* Класс живёт здесь, а не пилюлей над героем (0.33.0): заголовок уже
          есть, а подпись «· 2 класс» даёт ту же ориентацию за 0 px высоты. */}
      <h2 className="home-path-title">
        Мой путь
        {AVAILABLE_CLASSES.length > 1 && (
          <span className="home-path-class"> · {CLASS_META[grade].title}</span>
        )}
      </h2>
      <div
        id="home-path"
        className={`path${pathOpen ? ' path-all' : ''}`}
        data-path={pathOpen ? 'all' : 'preview'}
      >
        {visibleLessons.map((l) => {
          const st = profile.lessons[l.id];
          const level = st?.level ?? 0;
          const doneWords = l.wordIds.filter((id) => (profile.words[id]?.s ?? 0) > 0).length;
          const isCurrent = l.id === current.id;
          return (
            <div className="node" key={l.id}>
              <button
                className={`node-btn ${isCurrent ? 'current' : 'quiet'}`}
                onClick={() => onStartLesson(l.id)}
              >
                <span className="node-emoji">{l.emoji}</span>
                <span className="grow">
                  <span className="node-title">{l.title}</span>
                  <Crowns level={level} />
                  <div className="tiny">
                    {doneWords} / {l.wordIds.length} слов
                  </div>
                </span>
                <span style={{ fontSize: 22 }}>{isCurrent ? '▶' : '▸'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Переключатель пути (0.67.0). Свёрнуто — «Весь путь · 16 уроков»:
          ребёнок видит, что программа не кончилась, но не листает её всю.
          Раскрыто — «Свернуть»; состояние не запоминаем: новый день — снова
          «Дальше», чтобы главная каждый раз была короткой. */}
      <button
        type="button"
        className="path-toggle"
        data-path-toggle
        aria-expanded={pathOpen}
        aria-controls="home-path"
        onClick={() => setPathOpen((v) => !v)}
      >
        {pathOpen ? (
          <>
            Свернуть путь <span aria-hidden="true">⌃</span>
          </>
        ) : (
          <>
            Весь путь · {classLessons.length}{' '}
            {plural(classLessons.length, 'урок', 'урока', 'уроков')}{' '}
            <span aria-hidden="true">⌄</span>
          </>
        )}
      </button>

      {/* Ссылка на приложение — в один тап с главной (0.32.1), но ниже пути
          (0.67.0): приглашение — не ежедневное действие, и рядом с «Начать ▶»
          оно спорило за внимание. Осталось тихой текстовой ссылкой. */}
      <button
        type="button"
        className="invite-cta"
        aria-label="Позвать друга: показать QR-код или отправить ссылку"
        onClick={() => setInviteOpen(true)}
      >
        <span aria-hidden="true">🤝</span>
        <span className="invite-cta-text">Позови друга</span>
        <span className="invite-cta-arrow" aria-hidden="true">
          ➜
        </span>
      </button>

      {inviteOpen && <InviteFriend onClose={() => setInviteOpen(false)} />}
      {classOpen && <ClassSheet profile={profile} onClose={() => setClassOpen(false)} />}

      {/* Меню ☰: один уровень, крупные подписанные строки, только вторичные
          дела. Главное действие «Начать ▶» остаётся на экране и в меню не
          прячется. Сверху — расшифровка счётчиков: у 🔥 и 💎 должны быть слова. */}
      {menuOpen && (
        <div className="sheet-backdrop rewards-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            className="home-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row mb">
              <h2 className="grow" style={{ margin: 0 }}>
                Меню
              </h2>
              <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={() => setMenuOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="menu-status">
              <div className="menu-status-row">
                <span className="menu-status-emoji" aria-hidden="true">
                  <Icon name="crystal" size={22} />
                </span>
                <div className="grow">
                  <div className="menu-status-title">Кристаллы: {profile.gems}</div>
                </div>
              </div>
              <div className="menu-status-row">
                <span className="menu-status-emoji" aria-hidden="true">
                  <Icon name="flame" size={22} />
                </span>
                <div className="grow">
                  <div className="menu-status-title">
                    Серия: {profile.streak > 0
                      ? `${profile.streak} ${plural(profile.streak, 'день', 'дня', 'дней')} подряд`
                      : 'пока нет'}
                  </div>

                </div>
              </div>
            </div>

            <button
              type="button"
              className="menu-row menu-support-row"
              data-menu="support"
              aria-label="Для родителей: поддержать разработчика, добровольно"
              onClick={() => openMenuSheet(onOpenSupport)}
            >
              <span className="menu-row-emoji" aria-hidden="true">💛</span>
              <span className="grow">
                <span className="menu-row-title">Поддержать разработчика</span>
                <span className="tiny muted">Для родителей · добровольно</span>
              </span>
              <span className="menu-row-arrow" aria-hidden="true">›</span>
            </button>

            <div className="menu-list">
              <button
                type="button"
                className="menu-row"
                data-menu="rewards"
                aria-label={
                  rewards > 0
                    ? `Награды: ${rewards} ${plural(rewards, 'награда ждёт', 'награды ждут', 'наград ждут')}`
                    : 'Награды'
                }
                onClick={() => openMenuSheet(() => setRewardsOpen(true))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🎁</span>
                <span className="grow">
                  <span className="menu-row-title">Награды</span>
                  <span className="tiny muted">
                    {rewards > 0
                      ? `${rewards} ${plural(rewards, 'награда ждёт', 'награды ждут', 'наград ждут')}`
                      : 'Пока всё получено'}
                  </span>
                </span>
                {rewards > 0 && (
                  <span className="menu-count" aria-hidden="true">
                    {rewards > 9 ? '9+' : rewards}
                  </span>
                )}
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="purchases"
                onClick={() => openMenuSheet(() => onOpenShop('wardrobe'))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🎒</span>
                <span className="grow">
                  <span className="menu-row-title">Мои покупки</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="world"
                onClick={() => openMenuSheet(() => onOpenShop('world'))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🌍</span>
                <span className="grow">
                  <span className="menu-row-title">Мой мир</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <div className="menu-sep" aria-hidden="true" />

              <button
                type="button"
                className="menu-row"
                data-menu="class"
                onClick={() => openMenuSheet(() => setClassOpen(true))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🎓</span>
                <span className="grow">
                  <span className="menu-row-title">{CLASS_META[grade].title}</span>
                  <span className="tiny muted">
                    {classInfo.complete && nextGrade
                      ? `Пройден · можно перейти в ${CLASS_META[nextGrade].title}`
                      : `${classInfo.words} ${plural(classInfo.words, 'слово', 'слова', 'слов')} · пройдено ${classInfo.lessonsDone} из ${classInfo.lessons}`}
                  </span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="profiles"
                onClick={() => openMenuSheet(onOpenProfiles)}
              >
                <span className="menu-row-emoji" aria-hidden="true">👤</span>
                <span className="grow">
                  <span className="menu-row-title">Сменить ученика</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="share"
                onClick={() => openMenuSheet(() => setInviteOpen(true))}
              >
                <span className="menu-row-emoji" aria-hidden="true">📤</span>
                <span className="grow">
                  <span className="menu-row-title">Поделиться приложением</span>
                  <span className="tiny muted">QR-код или ссылка</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>
            </div>

            {/* Версия релиза (0.65.0): ребёнок может назвать её взрослому —
                «у меня 0.65.0», и по номеру сразу понятно, что проверять.
                Номер подставляется сборкой из package.json, руками не правим. */}
            <p className="menu-version tiny muted" data-menu-version>
              СЛОВО 2.0 · версия {import.meta.env.VITE_APP_VERSION}
            </p>
          </div>
        </div>
      )}

      {rewardsOpen && (
        <div className="sheet-backdrop rewards-backdrop" onClick={() => setRewardsOpen(false)}>
          <div
            className="rewards-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Награды"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row mb">
              <h2 className="grow" style={{ margin: 0 }}>
                Награды
              </h2>
              <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={() => setRewardsOpen(false)}>
                ✕
              </button>
            </div>
            <DailyQuests onStart={startQuest} />
            <WeeklyRewards />
          </div>
        </div>
      )}
    </div>
  );
}
