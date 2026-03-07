import { useState, useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useFeatureFlags } from '../../core/hooks/useFeatureFlags';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import type { EmotionKey } from '../../core/types';
import { useRandomRecall, getDaysAgoLabel } from './useRandomRecall';
import { CalendarView } from './CalendarView';
import styles from './ReflectionScreen.module.css';

type ViewMode = 'timeline' | 'calendar';

type EmotionFilter = 'all' | EmotionKey | 'idea';

const EMOTION_LABELS: Record<EmotionKey, string> = {
  wow: '😮',
  empathy: '😍',
  inspire: '🤯',
  think: '🤔',
  laugh: '😂',
  joy: '🥰',
  moved: '😢',
  fun: '✨',
};

const ALL_EMOTION_KEYS: EmotionKey[] = ['joy', 'wow', 'think', 'empathy', 'inspire', 'laugh', 'moved', 'fun'];

/**
 * 日付を「今日」「昨日」「M月D日（曜）」に変換
 */
function formatDateGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';

  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getMonth() + 1}月${date.getDate()}日（${DOW[date.getDay()]}）`;
}

/**
 * 投稿リストを日付（YYYY-MM-DD）でグループ化
 */
function groupByDate(hossiis: ReturnType<typeof useHossiiStore>['state']['hossiis']) {
  const groups: { label: string; items: typeof hossiis }[] = [];
  const seen = new Map<string, number>();

  for (const h of hossiis) {
    const key = h.createdAt.toISOString().slice(0, 10);
    if (seen.has(key)) {
      groups[seen.get(key)!].items.push(h);
    } else {
      seen.set(key, groups.length);
      groups.push({ label: formatDateGroupLabel(h.createdAt), items: [h] });
    }
  }
  return groups;
}

export const ReflectionScreen = () => {
  const { state } = useHossiiStore();
  const { hossiis, activeSpaceId } = state;
  const { flags } = useFeatureFlags(activeSpaceId);

  const [emotionFilter, setEmotionFilter] = useState<EmotionFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // アクティブスペースの投稿に絞り込み、新しい順
  const spaceHossiis = useMemo(() => {
    return hossiis
      .filter((h) => h.spaceId === activeSpaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [hossiis, activeSpaceId]);

  // フィルタ適用（感情フィルター + カレンダー選択日）
  const filteredHossiis = useMemo(() => {
    let result = spaceHossiis;

    // カレンダーで日付選択中は該当日のみ
    if (selectedDate) {
      result = result.filter((h) => h.createdAt.toISOString().slice(0, 10) === selectedDate);
    }

    if (emotionFilter === 'all') return result;
    if (emotionFilter === 'idea') {
      return result.filter(
        (h) => h.hashtags?.some((tag) => tag === 'アイデア' || tag.toLowerCase() === 'idea'),
      );
    }
    return result.filter((h) => h.emotion === emotionFilter);
  }, [spaceHossiis, emotionFilter, selectedDate]);

  // カレンダーで日付を選択 → タイムラインビューに切り替え
  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setViewMode('timeline');
  };

  // タイムラインに切り替えるとき選択日をリセット
  const handleSwitchToTimeline = () => {
    setSelectedDate(null);
    setViewMode('timeline');
  };

  // ランダム想起
  const { recalled, refresh: refreshRecall, hasRecallable } = useRandomRecall(
    spaceHossiis,
    flags.random_recall_enabled,
  );

  // 日付グループ
  const dateGroups = useMemo(() => groupByDate(filteredHossiis), [filteredHossiis]);

  return (
    <div className={styles.container}>
      <TopRightMenu />

      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>内省スペース</h1>
            <p className={styles.subtitle}>過去の自分と出会う</p>
          </div>
          {/* ビュー切り替え */}
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'timeline' ? styles.viewBtnActive : ''}`}
              onClick={handleSwitchToTimeline}
            >
              タイムライン
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              カレンダー
            </button>
          </div>
        </div>

        {/* 感情フィルター（タイムラインビューのみ表示） */}
        {viewMode === 'timeline' && (
          <div className={styles.filterRow}>
            {selectedDate && (
              <button
                type="button"
                className={`${styles.filterBtn} ${styles.filterBtnDate}`}
                onClick={() => setSelectedDate(null)}
                title="日付フィルターを解除"
              >
                📅 {selectedDate.slice(5).replace('-', '/')} ✕
              </button>
            )}
            <button
              type="button"
              className={`${styles.filterBtn} ${emotionFilter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setEmotionFilter('all')}
            >
              すべて
            </button>
            {ALL_EMOTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`${styles.filterBtn} ${emotionFilter === key ? styles.filterBtnActive : ''}`}
                onClick={() => setEmotionFilter(key)}
                title={key}
              >
                {EMOTION_LABELS[key]}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.filterBtn} ${emotionFilter === 'idea' ? styles.filterBtnActive : ''}`}
              onClick={() => setEmotionFilter('idea')}
            >
              💡 アイデア
            </button>
          </div>
        )}
      </header>

      <main className={styles.main}>
        {/* カレンダービュー */}
        {viewMode === 'calendar' && (
          <CalendarView hossiis={spaceHossiis} onSelectDate={handleSelectDate} />
        )}

        {/* タイムラインビュー */}
        {viewMode === 'timeline' && (
          <>
        {/* ランダム想起カード */}
        {flags.random_recall_enabled && hasRecallable && recalled && (
          <section className={styles.recallSection}>
            <div className={styles.recallLabel}>
              <span className={styles.recallIcon}>✦</span>
              {getDaysAgoLabel(recalled.createdAt)}のあなたは…
            </div>
            <div className={styles.recallCard}>
              {recalled.emotion && (
                <span className={styles.recallEmotion}>
                  {EMOJI_BY_EMOTION[recalled.emotion]}
                </span>
              )}
              <p className={styles.recallMessage}>
                {renderHossiiText(recalled) || '（感情だけの記録）'}
              </p>
              {recalled.imageUrl && (
                <img
                  src={recalled.imageUrl}
                  alt="過去の投稿画像"
                  className={styles.recallImage}
                  loading="lazy"
                />
              )}
              <div className={styles.recallFooter}>
                <span className={styles.recallDate}>
                  {recalled.createdAt.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <button
                  type="button"
                  className={styles.recallRefreshBtn}
                  onClick={refreshRecall}
                  aria-label="別の記録を見る"
                >
                  他の記録を見る →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* タイムライン */}
        <div className={styles.timeline}>
          {filteredHossiis.length === 0 ? (
            <div className={styles.empty}>
              {selectedDate
                ? 'この日の記録はありません'
                : emotionFilter === 'all'
                ? 'まだ記録がありません'
                : emotionFilter === 'idea'
                ? 'アイデアタグの記録がありません'
                : 'この気持ちの記録がありません'}
            </div>
          ) : (
            dateGroups.map((group) => (
              <div key={group.label} className={styles.dateGroup}>
                <div className={styles.dateLabel}>{group.label}</div>
                <div className={styles.groupItems}>
                  {group.items.map((hossii, index) => {
                    const emoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;
                    const text = renderHossiiText(hossii);

                    return (
                      <article
                        key={hossii.id}
                        className={styles.card}
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        <div className={styles.cardMain}>
                          {emoji && <span className={styles.cardEmoji}>{emoji}</span>}
                          <div className={styles.cardBody}>
                            {text && <p className={styles.cardMessage}>{text}</p>}
                            {hossii.imageUrl && (
                              <img
                                src={hossii.imageUrl}
                                alt="投稿画像"
                                className={styles.cardImage}
                                loading="lazy"
                              />
                            )}
                            {hossii.numberValue != null && (
                              <div className={styles.moodScore}>
                                気分スコア:
                                <span className={styles.moodValue}>{hossii.numberValue}</span>
                              </div>
                            )}
                            {hossii.hashtags && hossii.hashtags.length > 0 && (
                              <div className={styles.tagRow}>
                                {hossii.hashtags.map((tag) => (
                                  <span key={tag} className={styles.tag}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <time className={styles.cardTime}>
                          {hossii.createdAt.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
};
