import { useState, useCallback, useEffect, useMemo } from 'react';
import { Tag, X } from 'lucide-react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { renderHossiiText } from '../../core/utils/render';
import { loadFilters, saveFilters, type HossiiFilters } from '../../core/utils/filterStorage';
import type { Hossii } from '../../core/types';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { FilterBar } from '../FilterBar/FilterBar';
import { useFeatureFlags } from '../../core/hooks/useFeatureFlags';
import { useAuth } from '../../core/contexts/AuthContext';
import { fetchLikedIds, toggleLike } from '../../core/utils/likesApi';
import styles from './CommentsScreen.module.css';

type LikeButtonProps = {
  hossii: Hossii;
  likedByMe: boolean;
  onLike: (id: string) => void;
};

const LikeButton = ({ hossii, likedByMe, onLike }: LikeButtonProps) => {
  const [localLiked, setLocalLiked] = useState(likedByMe);
  const [localCount, setLocalCount] = useState(hossii.likeCount ?? 0);

  useEffect(() => {
    setLocalLiked(likedByMe);
    setLocalCount(hossii.likeCount ?? 0);
  }, [likedByMe, hossii.likeCount]);

  return (
    <button
      className={`${styles.likeButton} ${localLiked ? styles.likeButtonActive : ''}`}
      onClick={() => {
        const newLiked = !localLiked;
        setLocalLiked(newLiked);
        setLocalCount((c) => newLiked ? c + 1 : Math.max(0, c - 1));
        onLike(hossii.id);
      }}
      aria-label={localLiked ? 'いいねを取り消す' : 'いいね'}
    >
      {localLiked ? '❤️' : '🤍'}{localCount > 0 && ` ${localCount}`}
    </button>
  );
};

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
  const { currentUser } = useAuth();

  const { flags } = useFeatureFlags(activeSpaceId ?? undefined);

  const [filters, setFilters] = useState<HossiiFilters>(() => loadFilters(activeSpaceId));
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // タグフィルター
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

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

  // タグフィルター候補: presetTags ＋ 投稿に実際についているタグ
  const activeSpace = state.spaces.find((s) => s.id === activeSpaceId);
  const allTagCandidates = useMemo(() => {
    const set = new Set<string>(activeSpace?.presetTags ?? []);
    hossiis.forEach((h) => {
      h.tags?.forEach((t) => set.add(`#${t}`));
      h.hashtags?.forEach((t) => set.add(`#${t}`));
    });
    return Array.from(set).sort();
  }, [activeSpace?.presetTags, hossiis]);

  // likes_enabled フラグが ON のときにいいね済みIDを取得
  useEffect(() => {
    if (!currentUser || !flags.likes_enabled || hossiis.length === 0) return;
    const ids = hossiis.map((h) => h.id);
    fetchLikedIds(currentUser.uid, ids).then(setLikedIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, flags.likes_enabled, activeSpaceId]);

  const handleLike = useCallback(async (hossiiId: string) => {
    if (!currentUser) return;
    try {
      const nowLiked = await toggleLike(hossiiId, currentUser.uid);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (nowLiked) next.add(hossiiId);
        else next.delete(hossiiId);
        return next;
      });
    } catch (err) {
      console.error('[CommentsScreen] toggleLike error:', err);
    }
  }, [currentUser]);

  // 新しい順にソートしてフィルタ適用
  const sortedHossiis = useMemo(() => {
    const sorted = [...hossiis].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    let result = applyFilters(sorted, filters);
    if (selectedTags.length > 0) {
      const raw = selectedTags.map((t) => t.replace(/^#/, ''));
      result = result.filter((h) => {
        const searchIn = h.tags ?? h.hashtags;
        return raw.some((t) => searchIn?.includes(t));
      });
    }
    return result;
  }, [hossiis, filters, selectedTags]);

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
          {/* タグフィルター（タグが1件以上ある場合のみ表示） */}
          {allTagCandidates.length > 0 && (
            <div className={styles.tagFilterRow}>
              {selectedTags.map((tag) => (
                <span key={tag} className={styles.tagActiveChip}>
                  <Tag size={10} />
                  {tag}
                  <button
                    type="button"
                    className={styles.tagActiveRemove}
                    onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                    aria-label={`${tag} のフィルターを解除`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <div className={styles.tagDropdownWrapper}>
                <button
                  type="button"
                  className={styles.tagSelectButton}
                  onClick={() => setTagDropdownOpen((v) => !v)}
                >
                  <Tag size={12} />
                  タグで絞り込む
                </button>
                {tagDropdownOpen && (
                  <div className={styles.tagDropdown}>
                    {allTagCandidates
                      .filter((tag) => !selectedTags.includes(tag))
                      .map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={styles.tagDropdownItem}
                          onClick={() => {
                            setSelectedTags((prev) => [...prev, tag]);
                            setTagDropdownOpen(false);
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    {allTagCandidates.every((tag) => selectedTags.includes(tag)) && (
                      <span className={styles.tagDropdownEmpty}>すべて選択済み</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
                      {((hossii.tags?.length ?? 0) > 0 || (hossii.hashtags?.length ?? 0) > 0) && (
                        <div className={styles.cardTags}>
                          {hossii.tags?.map((tag) => (
                            <span key={`t-${tag}`} className={`${styles.cardTag} ${styles.cardTagPreset}`}>
                              #{tag}
                            </span>
                          ))}
                          {hossii.hashtags?.map((tag) => (
                            <span key={`h-${tag}`} className={`${styles.cardTag} ${styles.cardTagFree}`}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={styles.meta}>
                        <span className={styles.time}>{timestamp}</span>
                        {flags.likes_enabled && (
                          <LikeButton
                            hossii={hossii}
                            likedByMe={likedIds.has(hossii.id)}
                            onLike={handleLike}
                          />
                        )}
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
