import type { Hossii } from '../../core/types';
import styles from './StarView.module.css';

type Props = {
  hossii: Hossii;
  x: number; // % position
  y: number; // % position
  onClick: () => void;
  showPreview?: boolean;
};

const MAX_PREVIEW_TEXT = 40;

export const StarView = ({ hossii, x, y, onClick, showPreview }: Props) => {
  const isLaughter = hossii.autoType === 'laughter';
  const emotion = hossii.emotion;

  // Create varied animation delays based on position for organic feel
  const pulseDelay = ((x + y) * 37) % 100 / 100;
  const floatDelay = ((x * 53 + y * 71) % 100) / 100;
  const pulseDuration = 3 + ((x * y) % 20) / 10;

  // プレビューバブルは x>60% なら左側、それ以外は右側に出す
  const previewSide = x > 60 ? 'left' : 'right';

  const previewText = hossii.message
    ? hossii.message.slice(0, MAX_PREVIEW_TEXT) + (hossii.message.length > MAX_PREVIEW_TEXT ? '…' : '')
    : null;

  return (
    <button
      className={`${styles.star} ${showPreview ? styles.starHighlight : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        '--pulse-delay': `${pulseDelay}s`,
        '--float-delay': `${floatDelay}s`,
        '--pulse-duration': `${pulseDuration}s`,
      } as React.CSSProperties}
      onClick={onClick}
      aria-label={`${hossii.authorName || 'Post'} from ${hossii.createdAt.toLocaleTimeString()}`}
      data-emotion={emotion}
    >
      <span className={styles.starDot}>★</span>
      {isLaughter && <span className={styles.laughterBadge}>😂</span>}

      {showPreview && (previewText || hossii.imageUrl) && (
        <div
          className={`${styles.previewBubble} ${previewSide === 'left' ? styles.previewLeft : styles.previewRight}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hossii.imageUrl && (
            <img
              src={hossii.imageUrl}
              alt=""
              className={styles.previewImage}
            />
          )}
          {previewText && (
            <p className={styles.previewText}>{previewText}</p>
          )}
          {hossii.authorName && (
            <span className={styles.previewAuthor}>{hossii.authorName}</span>
          )}
        </div>
      )}
    </button>
  );
};
