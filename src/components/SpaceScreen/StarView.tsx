import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
import { formatPostDateLabel } from '../../core/utils/relativeTime';
import {
  resolveStarPreviewHorizontal,
  resolveStarPreviewVertical,
  MOBILE_LANDSCAPE_STAR_PREVIEW_MQ,
} from '../../core/utils/starPreviewPlacement';
import { resolveStarDotDepthScale } from '../../core/utils/timelineDepthScale';
import { useVisibleAnimationLevel } from '../../core/hooks/useVisibleAnimationLevel';
import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { HossiiFullTextPopover } from './HossiiFullTextPopover';
import { PinButton } from './PinButton';
import { resolvePostAuthorDisplay } from '../../core/utils/resolvePostAuthorDisplay';
import { PostedNameLabel } from '../common/PostedNameLabel';
import styles from './StarView.module.css';

type Props = {
  hossii: Hossii;
  /** 投稿者の現在スペースニックネーム（Phase 2C） */
  currentAuthorName?: string;
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
  displayIndex?: number;
  timelineDepthActive?: boolean;
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
  currentAuthorName,
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
  displayIndex = 0,
  timelineDepthActive = false,
}: Props) {
  // Phase 2C: 現在名を主表示、投稿時名と異なれば補足。
  const authorDisplay = resolvePostAuthorDisplay({
    postedName: hossii.authorName,
    currentName: currentAuthorName,
    isOwnPost: false,
  });
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

  const isMobileLandscape = useMediaQuery(MOBILE_LANDSCAPE_STAR_PREVIEW_MQ);
  const isMobileLandscapeRef = useRef(isMobileLandscape);

  const previewPlacementOptions = isMobileLandscape ? { landscape: true as const } : {};
  const previewHorizontal = resolveStarPreviewHorizontal(x, previewPlacementOptions);
  const previewVertical = resolveStarPreviewVertical(y, previewPlacementOptions);
  const previewDateLabel = formatPostDateLabel(hossii.createdAt);

  const fullText = getHossiiBubbleFullText(hossii);
  const previewText = fullText ? truncateStarPreviewText(fullText) : null;
  const hasPreviewContent = Boolean(
    previewText || hossii.imageUrl || hossii.authorName || previewDateLabel,
  );
  /** SP横: 親のローテ選択に依存せず常時インライン表示 */
  const isPreviewVisible =
    hasPreviewContent && (Boolean(showPreview) || isMobileLandscape);
  const depthScale = resolveStarDotDepthScale(timelineDepthActive, displayIndex);
  const starDotStyle =
    depthScale === 1
      ? undefined
      : ({ '--timeline-depth-scale': depthScale } as CSSProperties);

  useLayoutEffect(() => {
    if (!fullText || !isPreviewVisible) {
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
  }, [fullText, previewText, isPreviewVisible]);

  useEffect(() => {
    isZoneHoveredRef.current = isZoneHovered;
  }, [isZoneHovered]);

  useEffect(() => {
    isMobileLandscapeRef.current = isMobileLandscape;
  }, [isMobileLandscape]);

  useEffect(() => {
    const el = previewTextRef.current;
    if (!el || !fullText || !isPreviewVisible) return;
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
  }, [fullText, previewText, isPreviewVisible]);

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
    if (!isPreviewVisible || !isPreviewTruncated) return;
    const rect =
      previewBubbleRef.current?.getBoundingClientRect() ??
      wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    cancelHideFullText();
    setFullTextAnchorRect(rect);
    setShowFullTextPopover(true);
  }, [isPreviewVisible, isPreviewTruncated, cancelHideFullText]);

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
        if (!isMobileLandscapeRef.current) {
          onMouseEnter?.(e);
        }
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
      if (!isMobileLandscapeRef.current) {
        onMouseLeave?.();
      }
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
      className={`${styles.star} ${anchor === 'topLeft' ? styles.starAnchorTopLeft : ''} ${isPreviewVisible ? styles.starHighlight : ''} ${isMobileLandscape ? styles.starLandscapeInline : ''} ${isPcStarMode ? styles.starPc : ''} ${showPreview && isPcStarMode ? styles.starPreviewRotate : ''} ${orderedStackZ != null ? styles.starOrderedStack : ''} ${isRecentHighlight ? styles.starRecentGlow : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        '--pulse-delay': `${pulseDelay}s`,
        '--float-delay': `${floatDelay}s`,
        '--pulse-duration': `${pulseDuration}s`,
        ...(orderedStackZ != null ? { '--star-stack': orderedStackZ } : {}),
        ...(isMobileLandscape ? { '--preview-stack': displayIndex } : {}),
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
          style={starDotStyle}
          aria-hidden="true"
        >
          {MARKER_CHAR[markerType]}
        </span>
        {isLaughter && <span className={styles.laughterBadge}>😂</span>}
      </button>

      {isPreviewVisible && (
        <div
          ref={previewBubbleRef}
          className={[
            styles.previewBubble,
            previewHorizontal === 'left' ? styles.previewLeft : styles.previewRight,
            previewVertical === 'below' ? styles.previewBelow : styles.previewAbove,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          {previewDateLabel && (
            <time
              className={styles.previewDate}
              dateTime={hossii.createdAt.toISOString()}
            >
              {previewDateLabel}
            </time>
          )}
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
          {authorDisplay.primaryName && (
            <span className={styles.previewAuthorLine}>
              {emotionEmoji && (
                <span className={styles.previewEmotion} aria-hidden="true">
                  {emotionEmoji}
                </span>
              )}
              <span className={styles.previewAuthor}>{authorDisplay.primaryName}</span>
              <PostedNameLabel name={authorDisplay.postedNameLabel} />
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
    prev.currentAuthorName === next.currentAuthorName &&
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
    prev.displayIndex === next.displayIndex &&
    prev.timelineDepthActive === next.timelineDepthActive &&
    prev.anchor === next.anchor &&
    prev.orderedStackZ === next.orderedStackZ &&
    prev.onClick === next.onClick &&
    prev.onMouseEnter === next.onMouseEnter &&
    prev.onMouseLeave === next.onMouseLeave
  );
}

export const StarView = memo(StarViewInner, starViewPropsEqual);
