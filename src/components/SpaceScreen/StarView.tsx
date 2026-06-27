import { memo, useState } from 'react';
import type { Hossii } from '../../core/types';
import type { AnimationLevel } from '../../core/utils/animationLevel';
import type { StarMarkerType } from '../../core/types/settings';
import { DEFAULT_STAR_MARKER } from '../../core/types/settings';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { useVisibleAnimationLevel } from '../../core/hooks/useVisibleAnimationLevel';
import { PinButton } from './PinButton';
import styles from './StarView.module.css';

type Props = {
  hossii: Hossii;
  x: number;
  y: number;
  anchor?: 'center' | 'topLeft';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: () => void;
  showPreview?: boolean;
  isPcStarMode?: boolean;
  orderedStackZ?: number;
  isRecentHighlight?: boolean;
  animationLevel?: AnimationLevel;
  markerType?: StarMarkerType;
  isPinned?: boolean;
  onPinToggle?: (id: string) => void;
  showPinUi?: boolean;
};

const MAX_PREVIEW_TEXT = 60;

const MARKER_CHAR: Record<StarMarkerType, string> = {
  star: '★',
  circle: '●',
  pin: '',
  person: '',
};

function StarViewInner({
  hossii,
  x,
  y,
  anchor = 'center',
  onClick,
  onMouseEnter,
  onMouseLeave,
  showPreview,
  isPcStarMode = false,
  orderedStackZ,
  isRecentHighlight = false,
  animationLevel = 'full',
  markerType = DEFAULT_STAR_MARKER,
  isPinned = false,
  onPinToggle,
  showPinUi = false,
}: Props) {
  const [isStarHovered, setIsStarHovered] = useState(false);
  const previewInteractive = showPreview && (isPinned || isStarHovered);

  const { ref: visibilityRef, level: visibleLevel } = useVisibleAnimationLevel(
    animationLevel,
    animationLevel !== 'none',
  );

  const isLaughter = hossii.autoType === 'laughter';
  const emotion = hossii.emotion;
  const emotionEmoji = emotion ? EMOJI_BY_EMOTION[emotion] : null;

  const pulseDelay = ((x + y) * 37) % 100 / 100;
  const floatDelay = ((x * 53 + y * 71) % 100) / 100;
  const pulseDuration = 3 + ((x * y) % 20) / 10;

  const previewSide = x > 60 ? 'left' : 'right';

  const previewText = hossii.message
    ? hossii.message.slice(0, MAX_PREVIEW_TEXT) + (hossii.message.length > MAX_PREVIEW_TEXT ? '…' : '')
    : null;

  return (
    <button
      ref={visibilityRef}
      type="button"
      data-hossii-bubble
      data-hossii-id={hossii.id}
      className={`${styles.star} ${anchor === 'topLeft' ? styles.starAnchorTopLeft : ''} ${showPreview ? styles.starHighlight : ''} ${isPcStarMode ? styles.starPc : ''} ${showPreview && isPcStarMode ? styles.starPreviewRotate : ''} ${orderedStackZ != null ? styles.starOrderedStack : ''} ${isRecentHighlight ? styles.starRecentGlow : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        '--pulse-delay': `${pulseDelay}s`,
        '--float-delay': `${floatDelay}s`,
        '--pulse-duration': `${pulseDuration}s`,
        ...(orderedStackZ != null ? { '--star-stack': orderedStackZ } : {}),
      } as React.CSSProperties}
      onClick={onClick}
      onMouseEnter={(e) => {
        setIsStarHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={() => {
        setIsStarHovered(false);
        onMouseLeave?.();
      }}
      aria-label={`${hossii.authorName || 'Post'} from ${hossii.createdAt.toLocaleTimeString()}`}
      data-emotion={emotion}
      data-animation-level={visibleLevel}
    >
      <span
        className={`${styles.starDot}${markerType === 'pin' || markerType === 'person' ? ` ${styles[`marker_${markerType}`]}` : ''}`}
        aria-hidden="true"
      >
        {MARKER_CHAR[markerType]}
      </span>
      {isLaughter && <span className={styles.laughterBadge}>😂</span>}

      {showPreview && (previewText || hossii.imageUrl || hossii.authorName) && (
        <div
          className={[
            styles.previewBubble,
            previewSide === 'left' ? styles.previewLeft : styles.previewRight,
            previewInteractive ? styles.previewBubbleInteractive : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hossii.imageUrl && (
            <img
              src={hossii.imageUrl}
              alt=""
              className={styles.previewImage}
              loading="lazy"
              decoding="async"
            />
          )}
          {previewText && (
            <p className={styles.previewText}>{previewText}</p>
          )}
          {hossii.authorName && (
            <span className={styles.previewAuthorLine}>
              {emotionEmoji && (
                <span className={styles.previewEmotion} aria-hidden="true">
                  {emotionEmoji}
                </span>
              )}
              <span className={styles.previewAuthor}>{hossii.authorName}</span>
            </span>
          )}
          {showPinUi && onPinToggle && (
            <PinButton
              className={styles.previewPinButton}
              isPinned={isPinned}
              visible={isPinned || isStarHovered}
              onToggle={() => onPinToggle(hossii.id)}
            />
          )}
        </div>
      )}
    </button>
  );
}

function starViewPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.hossii === next.hossii &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.animationLevel === next.animationLevel &&
    prev.showPreview === next.showPreview &&
    prev.isPcStarMode === next.isPcStarMode &&
    prev.markerType === next.markerType &&
    prev.isPinned === next.isPinned &&
    prev.showPinUi === next.showPinUi &&
    prev.onPinToggle === next.onPinToggle &&
    prev.isRecentHighlight === next.isRecentHighlight &&
    prev.anchor === next.anchor &&
    prev.orderedStackZ === next.orderedStackZ &&
    prev.onClick === next.onClick &&
    prev.onMouseEnter === next.onMouseEnter &&
    prev.onMouseLeave === next.onMouseLeave
  );
}

export const StarView = memo(StarViewInner, starViewPropsEqual);
