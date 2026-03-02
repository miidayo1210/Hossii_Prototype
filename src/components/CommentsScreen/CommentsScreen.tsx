import { useState, useCallback, useEffect, useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { renderHossiiText } from '../../core/utils/render';
import { loadFilters, saveFilters, type HossiiFilters } from '../../core/utils/filterStorage';
import type { Hossii } from '../../core/types';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { FilterBar } from '../FilterBar/FilterBar';
import { useFeatureFlags } from '../../core/hooks/useFeatureFlags';
import styles from './CommentsScreen.module.css';

function applyFilters(hossiis: Hossii[], filters: HossiiFilters): Hossii[] {
  return hossiis.filter((h) => {
    const isComment = (!h.origin || h.origin === 'manual') && (!!h.message.trim() || !!h.imageUrl);
    const isEmotion = !!h.emotion;

    // どちらにも該当しない投稿（空メッセージかつ emotion なし）は常に表示
    if (!isComment && !isEmotion) return true;

    // 該当するカテゴリのうち、いずれかの filter が ON なら表示
    if (isComment && filters.comment) return true;
    if (isEmotion && filters.emotion) return true;
    return false;
  });
}

export const CommentsScreen = () => {
  const { state, getActiveSpaceHossiis } = useHossiiStore();
  const { activeSpaceId } = state;

  const { flags } = useFeatureFlags(activeSpaceId ?? undefined);

  const [filters, setFilters] = useState<HossiiFilters>(() => loadFilters(activeSpaceId));
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxUrl]);

  const handleFilterChange = useCallback((newFilters: HossiiFilters) => {
    setFilters(newFilters);
    saveFilters(activeSpaceId, newFilters);
  }, [activeSpaceId]);

  useEffect(() => {
    setFilters(loadFilters(activeSpaceId));
  }, [activeSpaceId]);

  // アクティブなスペースのログのみ取得
  const hossiis = getActiveSpaceHossiis();

  // 新しい順にソートしてフィルタ適用
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
                      {(!isLaughter && renderHossiiText(hossii)) && (
                        <div className={styles.message}>
                          {icon && <span className={styles.logIcon}>{icon}</span>}
                          {renderHossiiText(hossii)}
                        </div>
                      )}
                      {hossii.imageUrl && flags.comments_thumbnail && (
                        <button
                          type="button"
                          className={styles.imageThumb}
                          onClick={() => setLightboxUrl(hossii.imageUrl!)}
                          aria-label="画像を拡大表示"
                        >
                          <img
                            src={hossii.imageUrl}
                            alt="投稿画像"
                            className={styles.thumbImg}
                            loading="lazy"
                          />
                          <span className={styles.thumbHint}>タップして拡大</span>
                        </button>
                      )}
                      {hossii.imageUrl && !flags.comments_thumbnail && (
                        <a
                          href={hossii.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.imageLinkFallback}
                        >
                          📎 画像を開く
                        </a>
                      )}
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

      {lightboxUrl && (
        <div
          className={styles.lightbox}
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="画像拡大表示"
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightboxUrl(null)}
            aria-label="閉じる"
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="拡大画像"
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
