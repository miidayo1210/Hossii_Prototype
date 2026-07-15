import { useRef, useEffect, useLayoutEffect, useState, useCallback, memo } from 'react';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import type { Hossii } from '../../core/types';
import type { ViewMode } from '../../core/utils/displayPrefsStorage';
import type { AuthorPostGroup } from '../../core/utils/authorPostGroup';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { getEmotionColor } from '../../core/assets/emotionColors';
import { renderHossiiText } from '../../core/utils/render';
import { resolvePostAuthorDisplay } from '../../core/utils/resolvePostAuthorDisplay';
import { PostedNameLabel } from '../common/PostedNameLabel';
import styles from './AuthorClusterBubble.module.css';

const MAX_PREVIEW_POSTS = 20;

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function getPostEmoji(hossii: Hossii): string {
  if (hossii.autoType === 'laughter') return '😂';
  if (hossii.logType === 'speech' || hossii.autoType === 'speech') return '🎙';
  if (hossii.emotion) return EMOJI_BY_EMOTION[hossii.emotion];
  return '🌟';
}

function getPreviewText(hossii: Hossii): string {
  const text = renderHossiiText(hossii).trim();
  if (text.length <= 80) return text;
  return text.slice(0, 80) + '…';
}

type Props = {
  group: AuthorPostGroup;
  /** 投稿者の現在スペースニックネーム（Phase 2C）。異なれば「投稿時：旧名」を補足表示 */
  currentAuthorName?: string;
  position: { x: number; y: number };
  viewMode: ViewMode;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenTimeline: () => void;
  onPositionSave?: (latestPostId: string, x: number, y: number) => void;
  canEdit?: boolean;
  orderedStackZ?: number;
  isMobilePortrait?: boolean;
};

function AuthorClusterBubbleInner({
  group,
  currentAuthorName,
  position,
  viewMode,
  expanded,
  onToggleExpand,
  onOpenTimeline,
  onPositionSave,
  canEdit = false,
  orderedStackZ,
  isMobilePortrait = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  const positionRef = useRef(position);
  const onPositionSaveRef = useRef(onPositionSave);
  const canEditRef = useRef(canEdit);
  const latestPostIdRef = useRef(group.latestPost.id);
  const wasDraggingRef = useRef(false);

  useLayoutEffect(() => {
    positionRef.current = position;
    onPositionSaveRef.current = onPositionSave;
    canEditRef.current = canEdit;
    latestPostIdRef.current = group.latestPost.id;
  });

  const dragStateRef = useRef<{
    startPX: number;
    startPY: number;
    startBX: number;
    startBY: number;
    moved: boolean;
  } | null>(null);

  const displayPos = dragPos ?? position;
  const emotionColor = getEmotionColor(group.latestPost.emotion);
  // Phase 2C: グループ投稿者の現在名を主表示、投稿時名と異なれば補足。
  const authorDisplay = resolvePostAuthorDisplay({
    postedName: group.authorName,
    currentName: currentAuthorName,
    isOwnPost: false,
  });
  const primaryAuthorName = authorDisplay.primaryName || group.authorName;
  const initial = primaryAuthorName.charAt(0).toUpperCase() || '?';
  const previewPosts = group.posts.slice(-MAX_PREVIEW_POSTS);
  const hiddenCount = group.posts.length - previewPosts.length;
  const recentEmotions = group.posts.slice(-3).map(getPostEmoji);
  const showExpandBody = !isMobilePortrait && viewMode === 'full' && expanded;
  const showImageGrid = !isMobilePortrait && viewMode === 'image' && expanded;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canEdit) return;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      dragStateRef.current = {
        startPX: e.clientX,
        startPY: e.clientY,
        startBX: positionRef.current.x,
        startBY: positionRef.current.y,
        moved: false,
      };
    };

    el.addEventListener('pointerdown', onPointerDown);
    return () => el.removeEventListener('pointerdown', onPointerDown);
  }, [canEdit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current || !canEditRef.current) return;
      const { startPX, startPY, startBX, startBY } = dragStateRef.current;
      const dx = e.clientX - startPX;
      const dy = e.clientY - startPY;
      if (!dragStateRef.current.moved && Math.hypot(dx, dy) < 5) return;

      if (!dragStateRef.current.moved) {
        dragStateRef.current.moved = true;
        wasDraggingRef.current = true;
        setIsDragging(true);
      }

      const area = el.closest('[data-bubble-area]') as HTMLElement | null;
      const areaW = area?.clientWidth ?? window.innerWidth;
      const areaH = area?.clientHeight ?? window.innerHeight;
      const dX = (dx / areaW) * 100;
      const dY = (dy / areaH) * 100;
      const newPos = {
        x: Math.max(5, Math.min(95, startBX + dX)),
        y: Math.max(5, Math.min(90, startBY + dY)),
      };
      dragPosRef.current = newPos;
      setDragPos({ ...newPos });
    };

    const onPointerUp = () => {
      if (!dragStateRef.current) return;
      const { moved } = dragStateRef.current;
      if (moved && dragPosRef.current) {
        onPositionSaveRef.current?.(
          latestPostIdRef.current,
          dragPosRef.current.x,
          dragPosRef.current.y,
        );
      }
      dragStateRef.current = null;
      dragPosRef.current = null;
      setDragPos(null);
      setIsDragging(false);
      if (moved) {
        window.setTimeout(() => {
          wasDraggingRef.current = false;
        }, 0);
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [group.groupKey]);

  const handleClick = useCallback(() => {
    if (wasDraggingRef.current || isDragging) return;
    if (isMobilePortrait || viewMode === 'bubble') {
      onOpenTimeline();
      return;
    }
    onToggleExpand();
  }, [isDragging, isMobilePortrait, viewMode, onOpenTimeline, onToggleExpand]);

  const handleMoreClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenTimeline();
    },
    [onOpenTimeline],
  );

  const clusterStyle: React.CSSProperties & {
    '--cluster-stack'?: number;
    '--glow-color'?: string;
  } = {
    left: `${displayPos.x}%`,
    top: `${displayPos.y}%`,
    borderLeft: `3px solid ${emotionColor}`,
    ['--glow-color']: `${emotionColor}59`,
  };
  if (orderedStackZ != null) {
    clusterStyle['--cluster-stack'] = orderedStackZ;
  }

  const imagePosts = group.posts.filter((p) => p.imageUrl);

  return (
    <div
      ref={containerRef}
      className={[
        styles.cluster,
        isMobilePortrait ? styles.clusterMobile : '',
        group.isRecent ? styles.clusterRecent : '',
        isDragging ? styles.clusterDragging : '',
        expanded && !isMobilePortrait ? styles.clusterExpanded : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={clusterStyle}
      data-hossii-bubble
      data-author-cluster
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-expanded={expanded}
      aria-label={`${primaryAuthorName}の投稿 ${group.posts.length}件`}
    >
      <div className={styles.header}>
        <span
          className={styles.initialBadge}
          style={{
            backgroundColor: `${emotionColor}33`,
            color: emotionColor,
          }}
        >
          {initial}
        </span>
        <span className={styles.authorName}>{primaryAuthorName}</span>
        <PostedNameLabel name={authorDisplay.postedNameLabel} />
        <span className={styles.countBadge}>{group.posts.length}件</span>
        <span className={styles.timeLabel}>{formatTime(group.latestPost.createdAt)}</span>
        <span className={styles.emotionRow} aria-hidden>
          {recentEmotions.map((emoji, i) => (
            <span key={i}>{emoji}</span>
          ))}
        </span>
        <span className={styles.chevron} aria-hidden>
          {isMobilePortrait ? (
            <ChevronRight size={14} />
          ) : expanded ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
        </span>
      </div>

      {viewMode === 'full' && (
        <div
          className={`${styles.body} ${showExpandBody ? styles.bodyExpanded : styles.bodyCollapsed}`}
        >
          {previewPosts.map((post) => (
            <div key={post.id} className={styles.timelineRow}>
              <span className={styles.rowTime}>{formatTime(post.createdAt)}</span>
              <span className={styles.rowEmoji}>{getPostEmoji(post)}</span>
              <span className={styles.rowText}>{getPreviewText(post)}</span>
              {post.imageUrl && (
                <img src={post.imageUrl} alt="" className={styles.rowThumb} />
              )}
            </div>
          ))}
          {hiddenCount > 0 && (
            <button type="button" className={styles.moreLink} onClick={handleMoreClick}>
              他 {hiddenCount}件 ›
            </button>
          )}
        </div>
      )}

      {viewMode === 'image' && (
        <div
          className={`${styles.body} ${showImageGrid ? styles.bodyExpanded : styles.bodyCollapsed}`}
        >
          {imagePosts.length > 0 ? (
            <div className={styles.imageGrid}>
              {imagePosts.slice(-6).map((post) => (
                <img
                  key={post.id}
                  src={post.imageUrl}
                  alt=""
                  className={styles.imageGridThumb}
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          ) : (
            <div className={styles.imageOnlyBadge}>画像なし {group.posts.length}件</div>
          )}
        </div>
      )}
    </div>
  );
};

export const AuthorClusterBubble = memo(AuthorClusterBubbleInner);
