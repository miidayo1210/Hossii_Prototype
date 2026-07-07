import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Hossii } from '../../core/types';
import type { AuthorPostGroup } from '../../core/utils/authorPostGroup';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { getEmotionColor } from '../../core/assets/emotionColors';
import { renderHossiiText } from '../../core/utils/render';
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
  onLike?: (id: string) => void;
  onSelect: (id: string) => void;
};

function TimelinePostRow({ post, likesEnabled, onLike, onSelect }: PostRowProps) {
  const [localLikeCount, setLocalLikeCount] = useState(post.likeCount ?? 0);
  const [isLiked, setIsLiked] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onLike) return;
    setLocalLikeCount((c) => c + 1);
    setIsLiked(true);
    onLike(post.id);
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
          <button
            type="button"
            className={`${styles.likeButton} ${isLiked ? styles.likeButtonActive : ''}`}
            onClick={handleLike}
            aria-label="いいね"
          >
            {isLiked ? '❤️' : '🤍'}
            {localLikeCount > 0 && <span>{localLikeCount}</span>}
          </button>
        </div>
      )}
    </div>
  );
}

type Props = {
  group: AuthorPostGroup;
  onClose: () => void;
  onSelectPost: (id: string) => void;
  likesEnabled?: boolean;
  onLike?: (id: string) => void;
  isMobilePortrait?: boolean;
};

export const AuthorTimelineModal = ({
  group,
  onClose,
  onSelectPost,
  likesEnabled,
  onLike,
  isMobilePortrait = false,
}: Props) => {
  const hasPosts = group.posts.length > 0;
  const emotionColor = hasPosts ? getEmotionColor(group.latestPost.emotion) : '#a78bfa';

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
              {group.authorName} の投稿
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
