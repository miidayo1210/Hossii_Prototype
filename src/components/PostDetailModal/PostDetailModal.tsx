import { useEffect } from 'react';
import type { Hossii } from '../../core/types';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import { X } from 'lucide-react';
import styles from './PostDetailModal.module.css';

type Props = {
  hossii: Hossii;
  onClose: () => void;
};

export const PostDetailModal = ({ hossii, onClose }: Props) => {
  const emoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;
  const timestamp = hossii.createdAt.toLocaleString('ja-JP');

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

          {emoji && <div className={styles.emotion}>{emoji}</div>}

          <div className={styles.meta}>
            <span className={styles.time}>{timestamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
