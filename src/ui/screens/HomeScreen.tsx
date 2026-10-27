import { useEffect, useState } from 'react';
import { scheduleWordImages } from '../../platform/word-images';
import {
  CLASS_META,
  LESSONS_BY_GRADE,
  WORDS,
  availableClass,
} from '../../content/words';
import { dayKey, useActiveProfile } from '../../state/store';
import { Crowns } from '../Bits';
import { ClassSheet } from '../ClassSheet';
import { DailyQuests } from '../DailyQuests';
import { Gem, Icon } from '../Icon';
import { WeeklyRewards } from '../WeeklyRewards';
import { classProgress, nextClass } from '../../engine/classes';
import { levelOf } from '../../engine/rewards';
import { pickReviewWords } from '../../engine/srs';
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
  /** «Пора повторить» — отдельный режим тренировки, id урока не нужен */
  onStartReview: () => void;
  /** 🚗 Ангар БУКа — отдельная сцена коллекции техники в Slovo_Developer. */
  onOpenHangar: () => void;
  /** Меню ☰ ведёт прямо в «Мои покупки» или открывает ангар внутри БУКа. */
  onOpenShop: (view: 'vitrina' | 'wardrobe', hangar?: boolean) => void;
}

/**
 * Число у «Наград» в меню ☰ обещает ровно те действия, которые ребёнок
 * найдёт в листе: «Забрать» у задания, ежедневный и бонусный сундуки.
 * Недельные награды начисляются сами — их не считаем.
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

export function HomeScreen({
  onStartLesson,
  onOpenProfiles,
  onStartReview,
  onOpenHangar,
  onOpenShop,
}: Props) {
  const profile = useActiveProfile();
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);

  // Программа активного класса: у каждого ученика свой путь.
  const grade = availableClass(profile?.activeClass ?? 2);
  const classLessons = LESSONS_BY_GRADE[grade];
  const current =
    classLessons.find((l) => (profile?.lessons[l.id]?.level ?? 0) < 5) ??
    classLessons[classLessons.length - 1];
  const classInfo = classProgress(profile, grade);
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
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  if (!profile) return null;

  /** Задание дня: повторение ведёт в свой режим, остальные задания — в урок. */
  const startQuest = (kind: QuestKind) => {
    setRewardsOpen(false);
    if (kind === 'review') onStartReview();
    else onStartLesson(current.id);
  };

  const lvl = levelOf(profile.xp);
  // Повторение считаем по всем словам 1–4: при смене класса старые слова
  // должны возвращаться, а задание «Повтори N слов» оставаться выполнимым.
  const review = pickReviewWords(
    WORDS,
    profile.words,
    new Set(),
    12,
    new Set(profile.days[dayKey()]?.reviewWords ?? []),
  );
  const reviews = review.words;
  const reviewDue = reviews.length > 0 && review.kind === 'due';
  const currentDone = current.wordIds.filter((id) => (profile.words[id]?.s ?? 0) > 0).length;
  const rewards = rewardsCount(profile);

  const startHero = () => {
    if (reviewDue) onStartReview();
    else onStartLesson(current.id);
  };

  const openMenuSheet = (open: () => void) => {
    setMenuOpen(false);
    open();
  };

  return (
    <div className="screen">
      {/* Шапка из slovo2 0.68.0: один счётчик кристаллов и меню ☰. 🔥 и 🎁
          переехали в лист меню, где у чисел есть слова. */}
      <div className="topbar">
        <button
          type="button"
          className="profile-btn"
          title="Профили"
          aria-label={`Профиль: ${profile.name}. Сменить ученика`}
          onClick={onOpenProfiles}
        >
          <span className="avatar" aria-hidden="true">{profile.avatar}</span>
          <span className="topbar-name">{profile.name}</span>
        </button>
        <div className="grow" aria-hidden="true" />
        <div
          className="topbar-stat gems"
          role="img"
          data-stat="gems"
          aria-label={`Кристаллы: ${profile.gems}`}
        >
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
                ? `${reviews.length} ${plural(reviews.length, 'слово готово', 'слова готовы', 'слов готовы')} забыться`
                : `${currentDone} из ${current.wordIds.length} слов · ур. ${lvl}`}
            </span>
          </span>
        </div>
        <span className="home-hero-cta">Начать ▶</span>
      </button>

      <h2 className="home-path-title">Мой путь · {CLASS_META[grade].title}</h2>
      <div className="path">
        {classLessons.map((l) => {
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

      {classOpen && <ClassSheet profile={profile} onClose={() => setClassOpen(false)} />}

      {/* Меню ☰: один уровень, крупные подписанные строки. Главное действие
          «Начать ▶» остаётся на экране и в меню не прячется. */}
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
              <h2 className="grow" style={{ margin: 0 }}>Меню</h2>
              <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={() => setMenuOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="menu-status">
              <div className="menu-status-row">
                <span className="menu-status-emoji" aria-hidden="true"><Icon name="crystal" size={22} /></span>
                <div className="grow">
                  <div className="menu-status-title">Кристаллы: {profile.gems}</div>
                  <div className="tiny muted">
                    Копятся за уроки и задания. Тратятся в БУКе — на наряды, технику и музыку.
                  </div>
                </div>
              </div>
              <div className="menu-status-row">
                <span className="menu-status-emoji" aria-hidden="true"><Icon name="flame" size={22} /></span>
                <div className="grow">
                  <div className="menu-status-title">
                    Серия: {profile.streak > 0
                      ? `${profile.streak} ${plural(profile.streak, 'день', 'дня', 'дней')} подряд`
                      : 'пока нет'}
                  </div>
                  <div className="tiny muted">
                    {profile.streak > 0
                      ? 'Столько дней подряд ты занимаешься. Пропустишь день — счёт начнётся заново.'
                      : 'Позанимайся сегодня — и серия начнётся. День за днём она растёт.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="menu-list">
              <button
                type="button"
                className="menu-row"
                data-menu="rewards"
                aria-label={rewards > 0
                  ? `Награды: ${rewards} ${plural(rewards, 'награда ждёт', 'награды ждут', 'наград ждут')}`
                  : 'Награды'}
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
                {rewards > 0 && <span className="menu-count" aria-hidden="true">{rewards > 9 ? '9+' : rewards}</span>}
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
                  <span className="tiny muted">Наряды, техника, костюмы и музыка</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="hangar"
                onClick={() => openMenuSheet(onOpenHangar)}
              >
                <span className="menu-row-emoji" aria-hidden="true">🚗</span>
                <span className="grow">
                  <span className="menu-row-title">Ангар</span>
                  <span className="tiny muted">Твоя техника крупным планом</span>
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
                  <span className="tiny muted">Профили и новый ученик</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>
            </div>

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
              <h2 className="grow" style={{ margin: 0 }}>Награды</h2>
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
