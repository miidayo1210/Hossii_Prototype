import type { Hossii } from '../../core/types';
import styles from './StarView.module.css';

type Props = {
  hossii: Hossii;
  x: number; // % position
  y: number; // % position
  /** center: 従来どおり星の中心が (x,y)。topLeft: 格子整列用に星ボタンの左上が (x,y) */
  anchor?: 'center' | 'topLeft';
  onClick: () => void;
  showPreview?: boolean;
  /** 投稿順モード時: 格子セルに応じた重ね順（大きいほど手前） */
  orderedStackZ?: number;
  /** 直近の新着投稿として強調する */
  isRecentHighlight?: boolean;
};

const MAX_PREVIEW_TEXT = 40;

export const StarView = ({
  hossii,
  x,
  y,
  anchor = 'center',
  onClick,
  showPreview,
  orderedStackZ,
  isRecentHighlight = false,
}: Props) => {
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
      type="button"
      data-hossii-bubble
      className={`${styles.star} ${anchor === 'topLeft' ? styles.starAnchorTopLeft : ''} ${showPreview ? styles.starHighlight : ''} ${orderedStackZ != null ? styles.starOrderedStack : ''} ${isRecentHighlight ? styles.starRecentGlow : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        '--pulse-delay': `${pulseDelay}s`,
        '--float-delay': `${floatDelay}s`,
        '--pulse-duration': `${pulseDuration}s`,
        ...(orderedStackZ != null ? { '--star-stack': orderedStackZ } : {}),
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
