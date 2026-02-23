import { useState, useCallback, useEffect, useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { renderHossiiText } from '../../core/utils/render';
import { loadFilters, saveFilters, type HossiiFilters } from '../../core/utils/filterStorage';
import type { Hossii } from '../../core/types';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { FilterBar } from '../FilterBar/FilterBar';
import styles from './CommentsScreen.module.css';

/** フィルタ適用関数 */
function applyFilters(hossiis: Hossii[], filters: HossiiFilters): Hossii[] {
  return hossiis.filter((h) => {
    const isManual = !h.origin || h.origin === 'manual';
    const isAuto = h.origin === 'auto';

    if (isManual) return filters.manual;

    if (isAuto) {
      switch (h.autoType) {
        case 'emotion':
          return filters.autoEmotion;
        case 'speech':
          return filters.autoSpeech;
        case 'laughter':
          return filters.autoLaughter;
        default:
          return filters.autoEmotion;
      }
    }

    return true;
  });
}

export const CommentsScreen = () => {
  const { state, getActiveSpaceHossiis } = useHossiiStore();
  const { activeSpaceId } = state;

  // フィルタ状態
  const [filters, setFilters] = useState<HossiiFilters>(() => loadFilters(activeSpaceId));

  // フィルタ変更時に保存
  const handleFilterChange = useCallback((newFilters: HossiiFilters) => {
    setFilters(newFilters);
    saveFilters(activeSpaceId, newFilters);
  }, [activeSpaceId]);

  // スペースが変わったらフィルタをリロード
  useEffect(() => {
    setFilters(loadFilters(activeSpaceId));
  }, [activeSpaceId]);

  // アクティブなスペースのログのみ取得
  const hossiis = getActiveSpaceHossiis();

  // ソートとフィルタ適用
  const sortedHossiis = useMemo(() => {
    const sorted = [...hossiis].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    return applyFilters(sorted, filters);
  }, [hossiis, filters]);

  return (
    <div className={styles.container}>
      {/* 右上メニュー */}
      <TopRightMenu />

      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>コメント一覧</h1>
          <p className={styles.subtitle}>みんなの声が流れてくるよ</p>
        </div>
        <div className={styles.count}>
          {sortedHossiis.length} 件の投稿
        </div>
        {/* フィルタバー */}
        <div className={styles.filterContainer}>
          <FilterBar filters={filters} onFilterChange={handleFilterChange} />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className={styles.main}>
        <div className={styles.list}>
          {sortedHossiis.length === 0 ? (
            <div className={styles.empty}>
              まだ反応がありません
            </div>
          ) : (
            sortedHossiis.map((hossii) => {
              const timestamp = hossii.createdAt.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              });

              // 笑いログかどうか
              const isLaughter = hossii.autoType === 'laughter';
              // 音声ログかどうか
              const isSpeech = hossii.autoType === 'speech' || hossii.logType === 'speech';

              // アイコン
              const icon = isLaughter ? '😂' : isSpeech ? '🎙' : null;

              return (
                <div key={hossii.id} className={styles.card}>
                  <div className={styles.cardInner}>
                    <div className={styles.cardContent}>
                      {hossii.authorName && (
                        <div className={styles.authorName}>{hossii.authorName}</div>
                      )}
                      <div className={styles.message}>
                        {icon && <span className={styles.logIcon}>{icon}</span>}
                        {isLaughter ? '' : renderHossiiText(hossii)}
                      </div>
                      <div className={styles.meta}>
                        <span className={styles.time}>{timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};
