import { useState, useCallback, useEffect, useMemo } from 'react';
import { Tag, X } from 'lucide-react';
import { renderHossiiText } from '../../core/utils/render';
import { loadFilters, saveFilters, type HossiiFilters } from '../../core/utils/filterStorage';
import { loadLogScope, saveLogScope, type LogScope } from '../../core/utils/logScopeStorage';
import { getRelativeTime } from '../../core/utils/relativeTime';
import type { Hossii } from '../../core/types';
import { FilterBar } from '../FilterBar/FilterBar';
import { useSpaceSettings } from '../../core/hooks/useSpaceSettings';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAuth } from '../../core/contexts/useAuth';
import { fetchLikedIds, toggleLike } from '../../core/utils/likesApi';
import { coerceIsHidden } from '../../core/utils/hossiisApi';
import { LogScopeSegment } from './LogScopeSegment';
import styles from './CommentsScreen.module.css';

type LikeButtonProps = {
  hossii: Hossii;
  likedByMe: boolean;
  onLike: (id: string) => void;
};

const LikeButton = ({ hossii, likedByMe, onLike }: LikeButtonProps) => {
  const [localLiked, setLocalLiked] = useState(likedByMe);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    setLocalLiked(likedByMe);
  }, [likedByMe]);

  useEffect(() => {
    setDelta(0);
  }, [hossii.likeCount]);

  const displayCount = Math.max(0, (hossii.likeCount ?? 0) + delta);

  return (
    <button
      className={`${styles.likeButton} ${localLiked ? styles.likeButtonActive : ''}`}
      onClick={() => {
        const newLiked = !localLiked;
        setLocalLiked(newLiked);
        setDelta((d) => (newLiked ? d + 1 : d - 1));
        onLike(hossii.id);
      }}
      aria-label={localLiked ? 'いいねを取り消す' : 'いいね'}
    >
      {localLiked ? '❤️' : '🤍'} {displayCount}
    </button>
  );
};

function applyFilters(hossiis: Hossii[], filters: HossiiFilters): Hossii[] {
  return hossiis.filter((h) => {
    const isComment = (!h.origin || h.origin === 'manual') && (!!h.message.trim() || !!h.imageUrl);
    const isEmotion = !!h.emotion;

    if (!isComment && !isEmotion) return true;

    if (isComment && filters.comment) return true;
    if (isEmotion && filters.emotion) return true;
    return false;
  });
}

export type LogListBodyProps = {
  hossiis: Hossii[];
  spaceId: string | null;
  /** タグ候補のベース（スペースのプリセット）。空なら投稿のタグのみ */
  presetTags?: string[];
  panelMode?: boolean;
  onClose?: () => void;
  /** 管理者が非表示にした直後（訪問先リストなどストア外データの同期用） */
  onAfterAdminHide?: (id: string) => void;
  /** テスト・外部からのスコープ初期値注入用 */
  initialLogScope?: LogScope;
  /** フル画面の「投稿してみる」 */
  onNavigateToPost?: () => void;
  /** クイックログパネルの「投稿してみる」 */
  onOpenQuickPost?: () => void;
};

export function LogListBody({
  hossiis,
  spaceId,
  presetTags = [],
  panelMode = false,
  onClose,
  onAfterAdminHide,
  initialLogScope,
  onNavigateToPost,
  onOpenQuickPost,
}: LogListBodyProps) {
  const { currentUser } = useAuth();
  const { state, hideHossii, getActiveNickname } = useHossiiStore();
  const { profile } = state;
  const isAdmin = currentUser?.isAdmin ?? false;
  const space = useMemo(
    () => (spaceId ? state.spaces.find((s) => s.id === spaceId) ?? null : null),
    [state.spaces, spaceId],
  );
  const { spaceSettings } = useSpaceSettings(space);
  const likesEnabled = spaceSettings?.features.likesEnabled ?? true;

  const filterKey = spaceId ?? '';
  const [filters, setFilters] = useState<HossiiFilters>(() => loadFilters(filterKey));
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'likes'>('newest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [logScope, setLogScope] = useState<LogScope>(() => initialLogScope ?? loadLogScope());

  const handleScopeChange = useCallback((next: LogScope) => {
    setLogScope(next);
    saveLogScope(next);
  }, []);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxUrl]);

  const handleFilterChange = useCallback(
    (newFilters: HossiiFilters) => {
      setFilters(newFilters);
      saveFilters(filterKey, newFilters);
    },
    [filterKey]
  );

  useEffect(() => {
    setFilters(loadFilters(filterKey));
  }, [filterKey]);

  const visibleHossiis = useMemo(
    () => hossiis.filter((h) => !coerceIsHidden(h.isHidden)),
    [hossiis]
  );

  const allCount = visibleHossiis.length;
  const mineCount = useMemo(
    () =>
      profile?.id
        ? visibleHossiis.filter((h) => h.authorId === profile.id).length
        : 0,
    [visibleHossiis, profile?.id]
  );

  const scopedHossiis = useMemo(() => {
    if (logScope !== 'mine') return visibleHossiis;
    if (!profile?.id) return [];
    return visibleHossiis.filter((h) => h.authorId === profile.id);
  }, [visibleHossiis, logScope, profile?.id]);

  const allTagCandidates = useMemo(() => {
    const set = new Set<string>(presetTags);
    scopedHossiis.forEach((h) => {
      h.tags?.forEach((t) => set.add(`#${t}`));
      h.hashtags?.forEach((t) => set.add(`#${t}`));
    });
    return Array.from(set).sort();
  }, [presetTags, scopedHossiis]);

  useEffect(() => {
    if (!currentUser || !likesEnabled || scopedHossiis.length === 0) return;
    const ids = scopedHossiis.map((h) => h.id);
    fetchLikedIds(currentUser.uid, ids).then(setLikedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, likesEnabled, spaceId, logScope]);

  const handleHideFromLog = useCallback(
    (id: string) => {
      if (!window.confirm('この投稿を非表示にしますか？')) return;
      hideHossii(id, currentUser?.uid ?? undefined);
      onAfterAdminHide?.(id);
    },
    [hideHossii, currentUser?.uid, onAfterAdminHide]
  );

  const handleLike = useCallback(
    async (hossiiId: string) => {
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
        console.error('[LogListBody] toggleLike error:', err);
      }
    },
    [currentUser]
  );

  const sortedHossiis = useMemo(() => {
    const sorted = [...scopedHossiis].sort((a, b) =>
      sortOrder === 'likes'
        ? (b.likeCount ?? 0) - (a.likeCount ?? 0)
        : b.createdAt.getTime() - a.createdAt.getTime()
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
  }, [scopedHossiis, filters, selectedTags, sortOrder]);

  const isMineScope = logScope === 'mine';
  const activeNickname = getActiveNickname();

  const handleEmptyPostClick = useCallback(() => {
    if (panelMode) {
      onClose?.();
      onOpenQuickPost?.();
    } else {
      onNavigateToPost?.();
    }
  }, [panelMode, onClose, onOpenQuickPost, onNavigateToPost]);

  const filterBlock = (
    <div className={styles.filterContainer}>
      <div className={styles.sortBar}>
        <button
          type="button"
          className={`${styles.sortBtn} ${sortOrder === 'newest' ? styles.sortBtnActive : ''}`}
          onClick={() => setSortOrder('newest')}
        >
          新着順
        </button>
        <button
          type="button"
          className={`${styles.sortBtn} ${sortOrder === 'likes' ? styles.sortBtnActive : ''}`}
          onClick={() => setSortOrder('likes')}
        >
          ❤️ いいね順
        </button>
      </div>
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
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
  );

  const renderEmptyState = () => {
    if (isMineScope) {
      const hasProfile = !!profile?.id;
      return (
        <div className={styles.emptyMine}>
          <span className={styles.emptyMineIcon} aria-hidden>
            📭
          </span>
          <p className={styles.emptyMineTitle}>
            {!hasProfile
              ? 'まだ投稿がありません'
              : 'このスペースへの投稿はまだありません'}
          </p>
          <p className={styles.emptyMineSubtitle}>
            {!hasProfile
              ? '気持ちを投稿すると、ここに記録が残ります'
              : '最初の投稿をして記録を残してみよう！'}
          </p>
          <button type="button" className={styles.emptyMineAction} onClick={handleEmptyPostClick}>
            💬 投稿してみる
          </button>
        </div>
      );
    }
    return <div className={styles.empty}>まだ反応がありません</div>;
  };

  const listSection = (
    <div
      key={logScope}
      id="log-scope-panel"
      role="tabpanel"
      aria-labelledby={isMineScope ? 'log-scope-tab-mine' : 'log-scope-tab-all'}
      className={styles.listPane}
    >
      <div className={styles.list}>
        {sortedHossiis.length === 0 ? (
          renderEmptyState()
        ) : (
          sortedHossiis.map((hossii) => {
            const timestamp = isMineScope
              ? getRelativeTime(hossii.createdAt)
              : hossii.createdAt.toLocaleString('ja-JP', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

            const isLaughter = hossii.autoType === 'laughter';
            const isSpeech = hossii.autoType === 'speech' || hossii.logType === 'speech';
            const icon = isLaughter ? '😂' : isSpeech ? '🎙' : null;

            return (
              <div
                key={hossii.id}
                className={`${styles.card} ${isMineScope ? styles.mineCard : ''}`}
              >
                <div className={styles.cardInner}>
                  <div className={styles.cardContent}>
                    {!isMineScope && hossii.authorName && (
                      <div className={styles.authorName}>{hossii.authorName}</div>
                    )}
                    {(!isLaughter && renderHossiiText(hossii)) && (
                      <div className={styles.message}>
                        {icon && <span className={styles.logIcon}>{icon}</span>}
                        {renderHossiiText(hossii)}
                      </div>
                    )}
                    {hossii.imageUrl && (
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
                    {((hossii.tags?.length ?? 0) > 0 || (hossii.hashtags?.length ?? 0) > 0) && (
                      <div className={styles.cardTags}>
                        {hossii.tags?.map((tag) => (
                          <span
                            key={`t-${tag}`}
                            className={`${styles.cardTag} ${styles.cardTagPreset}`}
                          >
                            #{tag}
                          </span>
                        ))}
                        {hossii.hashtags?.map((tag) => (
                          <span
                            key={`h-${tag}`}
                            className={`${styles.cardTag} ${styles.cardTagFree}`}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={styles.meta}>
                      <span className={styles.time}>{timestamp}</span>
                      <div className={styles.metaEnd}>
                        {isAdmin && (
                          <button
                            type="button"
                            className={styles.adminHideButton}
                            onClick={() => handleHideFromLog(hossii.id)}
                            title="この投稿を非表示にする"
                          >
                            非表示
                          </button>
                        )}
                        {likesEnabled ? (
                          <LikeButton
                            hossii={hossii}
                            likedByMe={likedIds.has(hossii.id)}
                            onLike={handleLike}
                          />
                        ) : (
                          <span className={styles.likeCount}>🤍 {hossii.likeCount ?? 0}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const lightbox =
    lightboxUrl && (
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
    );

  const title = isMineScope ? '私のログ' : panelMode ? 'ログ一覧' : 'コメント一覧';
  const subtitle = isMineScope ? 'あなたが残したログ' : panelMode ? undefined : 'みんなの声が流れてくるよ';
  const countLabel = isMineScope
    ? `${sortedHossiis.length} 件`
    : `${sortedHossiis.length} 件の投稿`;

  const scopeHeaderBlock = (
    <div className={styles.scopeHeaderBlock}>
      <LogScopeSegment
        scope={logScope}
        allCount={allCount}
        mineCount={mineCount}
        onChange={handleScopeChange}
        compact={panelMode}
      />
      {isMineScope && activeNickname && (
        <div
          className={`${styles.identityBanner} ${panelMode ? styles.identityBannerCompact : ''}`}
          aria-live="polite"
        >
          <span aria-hidden>🙂</span>
          <span>
            {activeNickname} として参加中
          </span>
        </div>
      )}
      {!panelMode && (
        <div key={logScope} className={styles.headerTitleBlock}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
      )}
      <div className={styles.count}>{countLabel}</div>
    </div>
  );

  if (panelMode) {
    return (
      <div className={styles.panelRoot}>
        {onClose && (
          <div className={styles.panelCloseBar}>
            <span className={styles.panelTitle}>ログ一覧</span>
            <button type="button" className={styles.panelCloseButton} onClick={onClose} aria-label="閉じる">
              ✕ 閉じる
            </button>
          </div>
        )}
        <header className={styles.headerPanel}>
          {scopeHeaderBlock}
          {filterBlock}
        </header>
        <main className={styles.mainPanel} data-no-drag>
          {listSection}
        </main>
        {lightbox}
      </div>
    );
  }

  return (
    <>
      <header className={styles.header}>
        {scopeHeaderBlock}
        {filterBlock}
      </header>
      <main className={styles.main}>{listSection}</main>
      {lightbox}
    </>
  );
}
