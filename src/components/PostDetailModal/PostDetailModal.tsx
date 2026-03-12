import { useEffect, useState } from 'react';
import type { Hossii } from '../../core/types';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import { X } from 'lucide-react';
import styles from './PostDetailModal.module.css';

type Props = {
  hossii: Hossii;
  onClose: () => void;
  likesEnabled?: boolean;
  onLike?: (id: string) => void;
};

export const PostDetailModal = ({ hossii, onClose, likesEnabled, onLike }: Props) => {
  const emoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;
  const timestamp = hossii.createdAt.toLocaleString('ja-JP');
  const [localLikeCount, setLocalLikeCount] = useState(hossii.likeCount ?? 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleLikeClick = () => {
    if (!onLike) return;
    setLocalLikeCount((c) => c + 1);
    setIsLiked(true);
    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 400);
    onLike(hossii.id);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>

        <div className={styles.content}>
          {hossii.authorName && (
            <div className={styles.author}>{hossii.authorName}</div>
          )}

          <div className={styles.message}>{renderHossiiText(hossii)}</div>

          {hossii.imageUrl && (
            <img
              src={hossii.imageUrl}
              alt="投稿画像"
              className={styles.image}
            />
          )}

          {emoji && <div className={styles.emotion}>{emoji}</div>}

          <div className={styles.meta}>
            <span className={styles.time}>{timestamp}</span>
            {likesEnabled && (
              <button
                className={`${styles.likeButton} ${isLiked ? styles.likeButtonActive : ''} ${isBouncing ? styles.likeButtonBounce : ''}`}
                onClick={handleLikeClick}
                aria-label="いいね"
              >
                <span className={styles.likeHeart}>{isLiked ? '❤️' : '🤍'}</span>
                {localLikeCount > 0 && (
                  <span className={styles.likeCount}>{localLikeCount}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
