import { useEffect, useRef, useState, type AnimationEvent } from 'react';

/**
 * «Поиграть» с техникой по нажатию — как поворот телефона, но у каждого вида
 * техники свой, неповторимый трюк (анимации — в `styles/app.css`, блок
 * `.toy-play`): машина заводится и уносится за край карточки, корабль
 * качается на волнах, самолёт делает петлю, ноутбук оживает с блёстками,
 * телевизор переключает канал «по-старинке», наушники танцуют под музыку.
 *
 * Интерактив включается тем же флагом `interactive`, что и поворот телефона:
 * только там, где рисунок не внутри другой кнопки (витрина и подробная
 * карточка магазина). В ангаре и сцене техники клик занят выбором вещи.
 */

export type ToyPlayKind = 'car' | 'ship' | 'plane' | 'laptop' | 'tv' | 'headphones';

export const TOY_PLAY_COPY: Record<ToyPlayKind, { verb: string; title: string; hint: string }> = {
  car: {
    verb: 'нажми — машинка заведётся, умчится и вернётся',
    title: 'Нажми — машинка умчится!',
    hint: '🏎️ Нажми на машинку — она заведётся и умчится',
  },
  ship: {
    verb: 'нажми — корабль качнётся на волнах',
    title: 'Нажми — корабль покачается на волнах!',
    hint: '🌊 Нажми на корабль — он качнётся на волнах',
  },
  plane: {
    verb: 'нажми — самолёт сделает петлю',
    title: 'Нажми — самолёт сделает петлю!',
    hint: '✈️ Нажми на самолёт — он сделает петлю',
  },
  laptop: {
    verb: 'нажми — ноутбук оживёт',
    title: 'Нажми — ноутбук оживёт!',
    hint: '💻 Нажми на ноутбук — он оживёт',
  },
  tv: {
    verb: 'нажми — телевизор переключит канал',
    title: 'Нажми — телевизор переключит канал!',
    hint: '📺 Нажми на телевизор — он переключит канал',
  },
  headphones: {
    verb: 'нажми — наушники затанцуют',
    title: 'Нажми — наушники затанцуют!',
    hint: '🎧 Нажми на наушники — они затанцуют',
  },
};

/** Дольше самой длинной анимации: страховка, если animationend потеряется. */
const PLAY_TIMEOUT_MS = 2400;

/**
 * Состояние одного «трюка»: `play()` запускает анимацию заново (ключ `run`
 * пересоздаёт узел, поэтому повторное нажатие во время трюка начинает его
 * сначала), `is-playing` снимается по концу главной анимации или по таймеру
 * (при reduced-motion анимации нет и события не будет).
 */
export function useToyPlay() {
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = () => {
    setRun((value) => value + 1);
    setPlaying(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(false), PLAY_TIMEOUT_MS);
  };

  const onAnimationEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target === event.currentTarget) {
      window.clearTimeout(timer.current);
      setPlaying(false);
    }
  };

  return { run, playing, play, onAnimationEnd };
}

/**
 * Декоративные эффекты трюка поверх рисунка: линии скорости и пыль у машины,
 * волны и брызги у корабля, след у самолёта, блёстки у ноутбука, полосы
 * помех у телевизора, ноты у наушников. Оживают только под `.is-playing`
 * (см. CSS), в покое невидимы и кликов не перехватывают.
 */
export function ToyPlayFx({ kind }: { kind: ToyPlayKind }) {
  return (
    <span className="toy-play-fx" aria-hidden="true">
      {kind === 'car' && (
        <>
          <span className="toy-fx toy-fx-line l1" />
          <span className="toy-fx toy-fx-line l2" />
          <span className="toy-fx toy-fx-line l3" />
          <span className="toy-fx toy-fx-puff p1" />
          <span className="toy-fx toy-fx-puff p2" />
          <span className="toy-fx toy-fx-puff p3" />
        </>
      )}
      {kind === 'ship' && (
        <>
          <span className="toy-fx toy-fx-wave w1" />
          <span className="toy-fx toy-fx-wave w2" />
          <span className="toy-fx toy-fx-drop d1" />
          <span className="toy-fx toy-fx-drop d2" />
          <span className="toy-fx toy-fx-drop d3" />
        </>
      )}
      {kind === 'plane' && (
        <>
          <span className="toy-fx toy-fx-trail t1" />
          <span className="toy-fx toy-fx-trail t2" />
          <span className="toy-fx toy-fx-trail t3" />
          <span className="toy-fx toy-fx-trail t4" />
          <span className="toy-fx toy-fx-spark">✦</span>
        </>
      )}
      {kind === 'laptop' && (
        <>
          <span className="toy-fx toy-fx-pixel x1" />
          <span className="toy-fx toy-fx-pixel x2" />
          <span className="toy-fx toy-fx-pixel x3" />
          <span className="toy-fx toy-fx-ring" />
        </>
      )}
      {kind === 'tv' && (
        <>
          <span className="toy-fx toy-fx-scan s1" />
          <span className="toy-fx toy-fx-scan s2" />
          <span className="toy-fx toy-fx-scan s3" />
          <span className="toy-fx toy-fx-spark">✦</span>
        </>
      )}
      {kind === 'headphones' && (
        <>
          <span className="toy-fx toy-fx-note n1">♪</span>
          <span className="toy-fx toy-fx-note n2">♫</span>
          <span className="toy-fx toy-fx-note n3">♪</span>
        </>
      )}
    </span>
  );
}
