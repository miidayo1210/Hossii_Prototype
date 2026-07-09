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
  onMouseEnter?: (e: React.MouseEvent) => void;
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

const FULL_TEXT_HIDE_DELAY_MS = 150;

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
  const [isZoneHovered, setIsZoneHovered] = useState(false);
  const [showFullTextPopover, setShowFullTextPopover] = useState(false);
  const [fullTextAnchorRect, setFullTextAnchorRect] = useState<DOMRect | null>(null);
  const [isPreviewTruncated, setIsPreviewTruncated] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previewBubbleRef = useRef<HTMLDivElement>(null);
  const previewTextRef = useRef<HTMLParagraphElement>(null);
  const fullTextLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZoneHoveredRef = useRef(false);

  const { ref: visibilityRef, level: visibleLevel } = useVisibleAnimationLevel(
    animationLevel,
    animationLevel !== 'none',
  );

  const mergeWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      visibilityRef(node);
    },
    [visibilityRef],
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset truncation when preview hides
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
    isZoneHoveredRef.current = isZoneHovered;
  }, [isZoneHovered]);

  useEffect(() => {
    const el = previewTextRef.current;
    if (!el || !fullText || !showPreview) return;
    const update = () => {
      const truncated = isHossiiTextTruncated(fullText, previewText ?? '', el);
      setIsPreviewTruncated(truncated);
      if (truncated && isZoneHoveredRef.current) {
        const rect =
          previewBubbleRef.current?.getBoundingClientRect() ??
          wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
        setFullTextAnchorRect(rect);
        setShowFullTextPopover(true);
      }
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullText, previewText, showPreview]);

  const cancelHideFullText = useCallback(() => {
    if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
    fullTextLeaveTimerRef.current = null;
  }, []);

  const scheduleHideFullText = useCallback(() => {
    cancelHideFullText();
    fullTextLeaveTimerRef.current = setTimeout(() => {
      setShowFullTextPopover(false);
      setFullTextAnchorRect(null);
      fullTextLeaveTimerRef.current = null;
    }, FULL_TEXT_HIDE_DELAY_MS);
  }, [cancelHideFullText]);

  const showFullTextIfTruncated = useCallback(() => {
    if (!showPreview || !isPreviewTruncated) return;
    const rect =
      previewBubbleRef.current?.getBoundingClientRect() ??
      wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    cancelHideFullText();
    setFullTextAnchorRect(rect);
    setShowFullTextPopover(true);
  }, [showPreview, isPreviewTruncated, cancelHideFullText]);

  const isStillInsideHoverGroup = useCallback((target: EventTarget | null) => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !(target instanceof Node)) return false;
    return wrapper.contains(target);
  }, []);

  const handleGroupPointerEnter = useCallback(
    (e: React.PointerEvent) => {
      cancelHideFullText();
      wrapperRef.current?.classList.add(styles.starHoverGroupActive);
      if (!isZoneHoveredRef.current) {
        setIsZoneHovered(true);
        onMouseEnter?.(e);
      }
      showFullTextIfTruncated();
    },
    [cancelHideFullText, onMouseEnter, showFullTextIfTruncated],
  );

  const handleGroupPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (isStillInsideHoverGroup(e.relatedTarget)) return;
      wrapperRef.current?.classList.remove(styles.starHoverGroupActive);
      setIsZoneHovered(false);
      onMouseLeave?.();
      scheduleHideFullText();
    },
    [isStillInsideHoverGroup, onMouseLeave, scheduleHideFullText],
  );

  useEffect(() => {
    return () => {
      cancelHideFullText();
      wrapperRef.current?.classList.remove(styles.starHoverGroupActive);
    };
  }, [cancelHideFullText]);

  return (
    <>
    <div
      ref={mergeWrapperRef}
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
      onPointerEnter={handleGroupPointerEnter}
      onPointerLeave={handleGroupPointerLeave}
      data-emotion={emotion}
      data-animation-level={visibleLevel}
    >
      <button
        type="button"
        className={styles.starButton}
        data-hossii-id={hossii.id}
        onClick={onClick}
        aria-label={`${hossii.authorName || 'Post'} from ${hossii.createdAt.toLocaleTimeString()}`}
      >
        <span
          className={`${styles.starDot}${markerType === 'pin' || markerType === 'person' ? ` ${styles[`marker_${markerType}`]}` : ''}`}
          aria-hidden="true"
        >
          {MARKER_CHAR[markerType]}
        </span>
        {isLaughter && <span className={styles.laughterBadge}>😂</span>}
      </button>

      {showPreview && (previewText || hossii.imageUrl || hossii.authorName) && (
        <div
          ref={previewBubbleRef}
          className={[
            styles.previewBubble,
            previewSide === 'left' ? styles.previewLeft : styles.previewRight,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
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
              visible={isPinned || isZoneHovered}
              onToggle={() => onPinToggle(hossii.id)}
            />
          )}
        </div>
      )}
    </div>

    {showFullTextPopover && fullTextAnchorRect && (
      <HossiiFullTextPopover
        hossii={hossii}
        anchorRect={fullTextAnchorRect}
        variant="star"
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
