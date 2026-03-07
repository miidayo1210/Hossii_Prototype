import { useState, useMemo } from 'react';
import type { Hossii } from '../../core/types';
import type { EmotionKey } from '../../core/types';
import styles from './CalendarView.module.css';

// 感情ごとのカレンダードット色
const EMOTION_DOT_COLORS: Record<EmotionKey, string> = {
  joy: '#fbbf24',
  wow: '#60a5fa',
  think: '#a78bfa',
  empathy: '#f472b6',
  inspire: '#34d399',
  laugh: '#fb923c',
  moved: '#818cf8',
  fun: '#38bdf8',
};

const DEFAULT_DOT_COLOR = '#d1d5db';
const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  hossiis: Hossii[];
  onSelectDate: (dateKey: string) => void;
};

/**
 * 日付を YYYY-MM-DD 形式の文字列に変換
 */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * その日の投稿から最も多い感情（dominant emotion）を返す
 */
function getDominantEmotion(items: Hossii[]): EmotionKey | null {
  const counts: Partial<Record<EmotionKey, number>> = {};
  for (const h of items) {
    if (h.emotion) counts[h.emotion] = (counts[h.emotion] ?? 0) + 1;
  }
  let maxCount = 0;
  let dominant: EmotionKey | null = null;
  for (const [key, count] of Object.entries(counts) as [EmotionKey, number][]) {
    if (count > maxCount) {
      maxCount = count;
      dominant = key;
    }
  }
  return dominant;
}

export const CalendarView = ({ hossiis, onSelectDate }: Props) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // 日付 → 投稿リスト のマップ
  const postsByDate = useMemo(() => {
    const map = new Map<string, Hossii[]>();
    for (const h of hossiis) {
      const key = toDateKey(h.createdAt);
      const list = map.get(key) ?? [];
      list.push(h);
      map.set(key, list);
    }
    return map;
  }, [hossiis]);

  // カレンダーグリッド用の日付配列を生成
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun

    const days: (Date | null)[] = [];
    // 先頭の空白
    for (let i = 0; i < startDow; i++) days.push(null);
    // 日付
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(viewYear, viewMonth, d));
    }
    // 末尾を7の倍数に揃える
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewYear, viewMonth]);

  const todayKey = toDateKey(today);

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className={styles.calendar}>
      {/* 月ナビゲーション */}
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={goPrev} aria-label="前の月">
          ‹
        </button>
        <span className={styles.monthLabel}>
          {viewYear}年{viewMonth + 1}月
        </span>
        <button type="button" className={styles.navBtn} onClick={goNext} aria-label="次の月">
          ›
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className={styles.grid}>
        {DOW_LABELS.map((dow) => (
          <div key={dow} className={styles.dowCell}>
            {dow}
          </div>
        ))}

        {/* 日付セル */}
        {calendarDays.map((date, i) => {
          if (!date) {
            return <div key={`empty-${i}`} className={styles.emptyCell} />;
          }

          const key = toDateKey(date);
          const posts = postsByDate.get(key) ?? [];
          const isToday = key === todayKey;
          const hasPosts = posts.length > 0;
          const dominant = getDominantEmotion(posts);
          // ドットは最大3個（投稿数に応じて）
          const dotCount = Math.min(posts.length, 3);

          return (
            <button
              key={key}
              type="button"
              className={`${styles.dayCell} ${isToday ? styles.today : ''} ${hasPosts ? styles.hasPost : ''}`}
              onClick={() => hasPosts && onSelectDate(key)}
              disabled={!hasPosts}
              aria-label={`${date.getMonth() + 1}月${date.getDate()}日${hasPosts ? `（${posts.length}件）` : ''}`}
            >
              <span className={styles.dayNum}>{date.getDate()}</span>
              {hasPosts && (
                <span className={styles.dots}>
                  {Array.from({ length: dotCount }).map((_, di) => (
                    <span
                      key={di}
                      className={styles.dot}
                      style={{ background: dominant ? EMOTION_DOT_COLORS[dominant] : DEFAULT_DOT_COLOR }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className={styles.legend}>
        {Object.entries(EMOTION_DOT_COLORS).map(([emotion, color]) => (
          <span key={emotion} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color }} />
          </span>
        ))}
        <span className={styles.legendText}>ドットの色 = 多かった感情</span>
      </div>
    </div>
  );
};
