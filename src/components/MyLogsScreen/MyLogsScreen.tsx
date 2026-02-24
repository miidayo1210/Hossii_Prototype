import { useState, useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import styles from './MyLogsScreen.module.css';

/**
 * 相対時間を計算
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return '今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

type FilterType = 'all' | 'current';

export const MyLogsScreen = () => {
  const { state } = useHossiiStore();
  const { hossiis, spaces, profile, activeSpaceId } = state;

  const [filter, setFilter] = useState<FilterType>('all');

  // スペース名を解決
  const getSpaceName = (spaceId: string): string => {
    const space = spaces.find((f) => f.id === spaceId);
    return space?.name ?? '不明なスペース';
  };

  // 自分のログを抽出（authorId一致、かつ authorId が存在するもののみ）
  const myLogs = useMemo(() => {
    if (!profile?.id) return [];

    let logs = hossiis.filter((h) => h.authorId === profile.id);

    // フィルタ適用
    if (filter === 'current') {
      logs = logs.filter((h) => h.spaceId === activeSpaceId);
    }

    // 新しい順
    return logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [hossiis, profile?.id, filter, activeSpaceId]);

  // 現在のスペース名
  const currentSpaceName = getSpaceName(activeSpaceId);

  return (
    <div className={styles.container}>
      <TopRightMenu />

      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>マイログ</h1>
            <p className={styles.subtitle}>あなたが残したログ</p>
          </div>
          <div className={styles.filterGroup}>
            <button
              type="button"
              className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('all')}
            >
              すべて
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${filter === 'current' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('current')}
              title={currentSpaceName}
            >
              このスペース
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className={styles.main}>
        {/* カウント */}
        <div className={styles.count}>{myLogs.length} 件</div>

        {/* ログ一覧 */}
        <div className={styles.list}>
          {myLogs.length === 0 ? (
            <div className={styles.empty}>
              {!profile?.id
                ? 'まだ投稿がありません'
                : filter === 'current'
                ? 'このスペースへの投稿はまだありません'
                : '投稿履歴がありません'}
            </div>
          ) : (
            myLogs.map((hossii, index) => {
              const spaceName = getSpaceName(hossii.spaceId);
              const relativeTime = getRelativeTime(hossii.createdAt);
              const emoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;

              return (
                <article
                  key={hossii.id}
                  className={styles.card}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  {/* 1行目: スペース名 + 時間 */}
                  <div className={styles.cardHeader}>
                    <span className={styles.spacePill}>{spaceName}</span>
                    <span className={styles.time}>{relativeTime}</span>
                  </div>

                  {/* 2行目: 本文 */}
                  <p className={styles.message}>{renderHossiiText(hossii)}</p>

                  {/* 3行目: authorName + emotion（任意） */}
                  {(hossii.authorName || emoji) && (
                    <div className={styles.cardFooter}>
                      {hossii.authorName && (
                        <span className={styles.authorName}>{hossii.authorName}</span>
                      )}
                      {emoji && <span className={styles.emotionChip}>{emoji}</span>}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};
