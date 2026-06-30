import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Hossii } from '../../core/types';
import type { AnimationLevel } from '../../core/utils/animationLevel';
import type { StarMarkerType } from '../../core/types/settings';
import { DEFAULT_STAR_MARKER } from '../../core/types/settings';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import {
  getHossiiBubbleFullText,
  isHossiiTextTruncated,
  truncateStarPreviewText,
} from '../../core/utils/bubbleTextTruncation';
import { useVisibleAnimationLevel } from '../../core/hooks/useVisibleAnimationLevel';
import { HossiiFullTextPopover } from './HossiiFullTextPopover';
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
  const [showFullTextPopover, setShowFullTextPopover] = useState(false);
  const [fullTextAnchorRect, setFullTextAnchorRect] = useState<DOMRect | null>(null);
  const [isPreviewTruncated, setIsPreviewTruncated] = useState(false);
  const previewBubbleRef = useRef<HTMLDivElement>(null);
  const previewTextRef = useRef<HTMLParagraphElement>(null);
  const fullTextLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fullText = getHossiiBubbleFullText(hossii);
  const previewText = fullText ? truncateStarPreviewText(fullText) : null;

  useLayoutEffect(() => {
    if (!fullText || !showPreview) {
      setIsPreviewTruncated(false);
      return;
    }
    const truncated = isHossiiTextTruncated(
      fullText,
      previewText ?? '',
      previewTextRef.current,
    );
    setIsPreviewTruncated(truncated);
  }, [fullText, previewText, showPreview]);

  useEffect(() => {
    const el = previewTextRef.current;
    if (!el || !fullText || !showPreview) return;
    const update = () => {
      setIsPreviewTruncated(
        isHossiiTextTruncated(fullText, previewText ?? '', el),
      );
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullText, previewText, showPreview]);

  const scheduleHideFullText = useCallback(() => {
    if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
    fullTextLeaveTimerRef.current = setTimeout(() => {
      setShowFullTextPopover(false);
      setFullTextAnchorRect(null);
    }, 100);
  }, []);

  const showInlineFullText = useCallback(() => {
    if (!showPreview || !previewInteractive || !isPreviewTruncated) return;
    const rect = previewBubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
    setFullTextAnchorRect(rect);
    setShowFullTextPopover(true);
  }, [showPreview, previewInteractive, isPreviewTruncated]);

  useEffect(() => {
    if (previewInteractive && isPreviewTruncated) {
      showInlineFullText();
    } else if (!previewInteractive) {
      scheduleHideFullText();
    }
  }, [previewInteractive, isPreviewTruncated, showInlineFullText, scheduleHideFullText]);

  useEffect(() => {
    return () => {
      if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
    };
  }, []);

  return (
    <>
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
          ref={previewBubbleRef}
          className={[
            styles.previewBubble,
            previewSide === 'left' ? styles.previewLeft : styles.previewRight,
            previewInteractive ? styles.previewBubbleInteractive : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={showInlineFullText}
          onMouseLeave={scheduleHideFullText}
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
            <p ref={previewTextRef} className={styles.previewText}>{previewText}</p>
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

    {showFullTextPopover && fullTextAnchorRect && (
      <HossiiFullTextPopover
        hossii={hossii}
        anchorRect={fullTextAnchorRect}
        variant="star"
        onMouseEnter={() => {
          if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
        }}
        onMouseLeave={scheduleHideFullText}
      />
    )}
    </>
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
