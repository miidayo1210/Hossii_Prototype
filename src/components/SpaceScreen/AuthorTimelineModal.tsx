import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Hossii } from '../../core/types';
import type { AuthorPostGroup } from '../../core/utils/authorPostGroup';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { getEmotionColor } from '../../core/assets/emotionColors';
import { renderHossiiText } from '../../core/utils/render';
import { resolvePostAuthorDisplay } from '../../core/utils/resolvePostAuthorDisplay';
import { fetchLikedIds, type LikeMutationResult } from '../../core/utils/likesApi';
import {
  LIKE_MUTATION_ERROR_MESSAGE,
  previewOptimisticLikeState,
} from '../../core/utils/likeMutationUi';
import { useAuth } from '../../core/contexts/useAuth';
import styles from './AuthorTimelineModal.module.css';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function getPostEmoji(hossii: Hossii): string {
  if (hossii.autoType === 'laughter') return '😂';
  if (hossii.logType === 'speech' || hossii.autoType === 'speech') return '🎙';
  if (hossii.emotion) return EMOJI_BY_EMOTION[hossii.emotion];
  return '🌟';
}

type PostRowProps = {
  post: Hossii;
  likesEnabled?: boolean;
  likedByMe?: boolean;
  isLoggedIn?: boolean;
  onLike?: (id: string) => Promise<LikeMutationResult>;
  onSelect: (id: string) => void;
};

function TimelinePostRow({
  post,
  likesEnabled,
  likedByMe = false,
  isLoggedIn = false,
  onLike,
  onSelect,
}: PostRowProps) {
  const [localLikeCount, setLocalLikeCount] = useState(post.likeCount ?? 0);
  const [isLiked, setIsLiked] = useState(likedByMe);
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const heartLiked = isLiked || likedByMe;

  useEffect(() => {
    setIsLiked(likedByMe);
  }, [likedByMe]);

  useEffect(() => {
    queueMicrotask(() => setLocalLikeCount(post.likeCount ?? 0));
  }, [post.likeCount]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onLike || likePending) return;
    const prevCount = localLikeCount;
    const prevLiked = isLiked;
    const preview = previewOptimisticLikeState({
      isLoggedIn,
      wasLiked: heartLiked,
      baseCount: localLikeCount,
    });
    setLocalLikeCount(preview.count);
    setIsLiked(preview.liked);
    setLikeError(null);
    setLikePending(true);
    try {
      const result = await onLike(post.id);
      setLocalLikeCount(result.likeCount);
      setIsLiked(result.liked);
    } catch {
      setLocalLikeCount(prevCount);
      setIsLiked(prevLiked);
      setLikeError(LIKE_MUTATION_ERROR_MESSAGE);
    } finally {
      setLikePending(false);
    }
  };

  return (
    <div
      className={styles.postRow}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(post.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(post.id);
        }
      }}
    >
      <div className={styles.rowMeta}>
        <span className={styles.rowTime}>{formatTime(post.createdAt)}</span>
        <span className={styles.rowEmoji}>{getPostEmoji(post)}</span>
      </div>
      <div className={styles.rowMessage}>{renderHossiiText(post)}</div>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="投稿画像" className={styles.rowImage} />
      )}
      {likesEnabled && onLike && (
        <div className={styles.rowFooter}>
          <span className={styles.likeButtonWrap}>
            <button
              type="button"
              className={`${styles.likeButton} ${heartLiked ? styles.likeButtonActive : ''}`}
              onClick={handleLike}
              disabled={likePending}
              aria-label="いいね"
            >
              {heartLiked ? '❤️' : '🤍'}
              {localLikeCount > 0 && <span>{localLikeCount}</span>}
            </button>
            {likeError && (
              <span className={styles.likeError} role="alert">
                {likeError}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

type Props = {
  group: AuthorPostGroup;
  /** 投稿者の現在スペースニックネーム（Phase 2C） */
  currentAuthorName?: string;
  onClose: () => void;
  onSelectPost: (id: string) => void;
  likesEnabled?: boolean;
  onLike?: (id: string) => Promise<LikeMutationResult>;
  isMobilePortrait?: boolean;
};

export const AuthorTimelineModal = ({
  group,
  currentAuthorName,
  onClose,
  onSelectPost,
  likesEnabled,
  onLike,
  isMobilePortrait = false,
}: Props) => {
  const hasPosts = group.posts.length > 0;
  const { currentUser } = useAuth();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser?.uid || !likesEnabled) return;
    const ids = group.posts.map((p) => p.id);
    fetchLikedIds(currentUser.uid, ids).then(setLikedIds);
  }, [currentUser?.uid, likesEnabled, group.posts]);
  const emotionColor = hasPosts ? getEmotionColor(group.latestPost.emotion) : '#a78bfa';
  // Phase 2C: 現在名を主表示（投稿時名との併記はタイトルでは簡潔さのため主表示のみ）。
  const primaryAuthorName =
    resolvePostAuthorDisplay({
      postedName: group.authorName,
      currentName: currentAuthorName,
      isOwnPost: false,
    }).primaryName || group.authorName;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      data-space-export="exclude"
      role="dialog"
      aria-modal="true"
      aria-labelledby="author-timeline-title"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        data-bottom-sheet={isMobilePortrait ? 'true' : undefined}
      >
        {isMobilePortrait && <div className={styles.handle} aria-hidden />}
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
        <header className={styles.header}>
          <div
            className={styles.accentLine}
            style={{ backgroundColor: emotionColor }}
            aria-hidden
          />
          <div className={styles.headerText}>
            <h2 id="author-timeline-title" className={styles.title}>
              {primaryAuthorName} の投稿
            </h2>
            <p className={styles.subtitle}>
              {hasPosts
                ? `全 ${group.posts.length}件 · 最終 ${formatTime(group.latestPost.createdAt)}`
                : '表示できるログはまだありません'}
            </p>
          </div>
        </header>
        <div className={styles.body}>
          {hasPosts ? (
            group.posts.map((post) => (
              <TimelinePostRow
                key={`${post.id}-${post.likeCount ?? 0}`}
                post={post}
                likesEnabled={likesEnabled}
                likedByMe={likedIds.has(post.id)}
                isLoggedIn={!!currentUser}
                onLike={onLike}
                onSelect={onSelectPost}
              />
            ))
          ) : (
            <p className={styles.emptyState}>
              {group.emptyMessage ?? 'このスペースには、まだ表示できるログがありません。'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
