import { useEffect, useState } from 'react';
import type { Hossii } from '../../core/types';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import { X } from 'lucide-react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAuth } from '../../core/contexts/useAuth';
import { resolvePostAuthorDisplay } from '../../core/utils/resolvePostAuthorDisplay';
import { canManageOwnPost } from '../../core/utils/canManageOwnPost';
import { PostedNameLabel } from '../common/PostedNameLabel';
import { OwnPostActions } from '../OwnPostActions/OwnPostActions';
import { OwnerOnlyBadge } from '../OwnPostActions/OwnerOnlyBadge';
import styles from './PostDetailModal.module.css';

type Props = {
  hossii: Hossii;
  onClose: () => void;
  likesEnabled?: boolean;
  onLike?: (id: string) => void;
  readOnlyArchived?: boolean;
};

export const PostDetailModal = ({
  hossii,
  onClose,
  likesEnabled,
  onLike,
  readOnlyArchived = false,
}: Props) => {
  const { postAuthorDisplayNames, myAuthorshipIds, myAuthorshipIdsStatus } = useHossiiStore();
  const { currentUser } = useAuth();
  const authorDisplay = resolvePostAuthorDisplay({
    postedName: hossii.authorName,
    currentName: postAuthorDisplayNames.get(hossii.id),
    isOwnPost: false,
  });
  const isOwnerOnly = hossii.visibility === 'owner_only';
  const canManage =
    !readOnlyArchived &&
    canManageOwnPost({
      isAuthenticated: !!currentUser,
      myAuthorshipIds,
      myAuthorshipIdsStatus,
      hossiiId: hossii.id,
    });
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
          {(isOwnerOnly || canManage) && (
            <div className={styles.ownerBar}>
              {isOwnerOnly ? <OwnerOnlyBadge /> : <span />}
              {canManage && <OwnPostActions hossii={hossii} onDeleted={onClose} />}
            </div>
          )}

          {authorDisplay.primaryName && (
            <div className={styles.author}>
              {authorDisplay.primaryName}
              <PostedNameLabel name={authorDisplay.postedNameLabel} />
            </div>
          )}

          <div className={styles.message}>{renderHossiiText(hossii)}</div>

          {hossii.contentEditedAt && (
            <span className={styles.editedMark}>編集済み</span>
          )}

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
