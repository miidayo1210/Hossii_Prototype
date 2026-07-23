import { useRef, useEffect, useLayoutEffect, useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Hossii } from '../../core/types';
import type { LikeMutationResult } from '../../core/utils/likesApi';
import { EMOJI_BY_EMOTION } from '../../core/utils/render';
import type { ViewMode } from '../../core/utils/displayPrefsStorage';
import type { AnimationLevel } from '../../core/utils/animationLevel';
import { useVisibleAnimationLevel } from '../../core/hooks/useVisibleAnimationLevel';
import { PinButton } from './PinButton';
import { HossiiFullTextPopover } from './HossiiFullTextPopover';
import { BUBBLE_INLINE_EDIT_COLORS } from '../../core/utils/bubbleColorPalettes';
import {
  getHossiiBubbleFullText,
  isHossiiTextTruncated,
  MAX_BUBBLE_TEXT_LENGTH,
  truncateBubbleDisplayText,
  bubbleLineClampForScale,
} from '../../core/utils/bubbleTextTruncation';
import { withBubbleAlpha, BUBBLE_BG_ALPHA, BUBBLE_BG_ALPHA_HOVER } from '../../core/utils/bubbleColorAlpha';
import { useCustomBubbleLandscapeClamp } from '../../core/hooks/useCustomBubbleLandscapeClamp';
import { resolvePostAuthorDisplay } from '../../core/utils/resolvePostAuthorDisplay';
import { PostedNameLabel } from '../common/PostedNameLabel';
import { OwnPostActions } from '../OwnPostActions/OwnPostActions';
import { OwnerOnlyBadge } from '../OwnPostActions/OwnerOnlyBadge';
import { BubbleActionMenu } from './BubbleActionMenu';
import { exceedsBubbleDragThreshold } from '../../core/utils/bubbleDragThreshold';
import { useAuth } from '../../core/contexts/useAuth';
import {
  LIKE_MUTATION_ERROR_MESSAGE,
  previewOptimisticLikeState,
} from '../../core/utils/likeMutationUi';
import styles from './SpaceScreen.module.css';

const BUBBLE_COLORS = BUBBLE_INLINE_EDIT_COLORS;

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return '今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

// BubbleEditMode は外部で参照されないが後方互換のため残す
export type BubbleEditMode = 'none' | 'moving' | 'resizing';

type ResizeCorner = 'TL' | 'TR' | 'BL' | 'BR';

function getCornerFromTarget(target: HTMLElement): ResizeCorner {
  const handle = target.closest('[data-resize-handle]') as HTMLElement | null;
  return (handle?.dataset.resizeHandle as ResizeCorner) ?? 'BR';
}

type BubbleProps = {
  hossii: Hossii;
  /** 投稿者の現在スペースニックネーム（Phase 2C）。異なれば「投稿時：旧名」を補足表示 */
  currentAuthorName?: string;
  index: number;
  position: { x: number; y: number };
  isActive: boolean;
  onActivate: () => void;
  isSelected?: boolean;
  /** クリックで選択（未選択 → 選択）*/
  onSelect?: (id: string) => void;
  /** PointerUp 時に位置を確定保存 */
  onPositionSave?: (id: string, x: number, y: number) => void;
  /** PointerUp 時にスケールを確定保存 */
  onScaleSave?: (id: string, scale: number) => void;
  /** カラー選択時に確定保存 */
  onColorSave?: (id: string, color: string | null) => void;
  /** F03: 表示モード */
  viewMode?: ViewMode;
  /** F02/F04: 編集権限（false の場合ドラッグ・リサイズ・色変更不可） */
  canEdit?: boolean;
  /** SpaceSettings.features.likesEnabled が ON の場合のみ true */
  likesEnabled?: boolean;
  /** いいねトグル時のコールバック（楽観的更新は Bubble 内で行い、Supabase 処理は親で行う） */
  onLike?: (id: string) => Promise<LikeMutationResult>;
  /** カスタム吹き出し形状PNGのパス（指定するとmask-imageでPNG形状に切り抜かれる） */
  bubbleShapePng?: string;
  /** 投稿順レイアウト時: 左上基準でスケール・見た目を揃える */
  layoutAlignTopLeft?: boolean;
  /** 投稿順モード時のみ: 格子セル番号に応じた重ね順（大きいほど手前＝右下ほど上） */
  orderedStackZ?: number;
  /** 直近の新着投稿として紫の輪郭で強調する */
  isRecentHighlight?: boolean;
  /** アニメーション tier（87 §8） */
  animationLevel?: AnimationLevel;
  isPinned?: boolean;
  onPinToggle?: (id: string) => void;
  showPinUi?: boolean;
  /**
   * ログイン本人の投稿で、本人操作（編集/公開範囲/削除）を吹き出し直下に出せるか。
   * 呼び出し側が canManageOwnPost で判定する（authorship 正本・他人/ゲストには出さない）。
   */
  canManageOwn?: boolean;
  /** 本人操作から削除が成功したときに選択解除するためのコールバック */
  onOwnerDeleted?: () => void;
  /** PC custom random/ordered: compact action menu gate */
  actionMenuEnabled?: boolean;
  actionMenuOpen?: boolean;
  onActionMenuToggle?: () => void;
  onViewDetail?: () => void;
  onConnect?: () => void;
  membershipJoinStatus?: 'joining' | 'error';
  onMembershipRetry?: () => void;
  connectionCount?: number;
  onConnectionsClick?: () => void;
  /** 通常時 ✦N（選択中は overlay が正本のため非表示） */
  connectionBadgeCount?: number;
  /** つなぎ先選択中の候補ハイライト */
  isConnectionPickTarget?: boolean;
  /** 糸編集中はメニュー toggle を抑止 */
  suppressActionMenuToggle?: boolean;
  /** compact menu 内 pull ハンドル */
  showPullHandle?: boolean;
  /** 選択 Bubble 右上の常設 pull ハンドル（PC custom のみ） */
  showBubblePullHandle?: boolean;
  /** 初回 pull ガイド */
  showConnectionPullHint?: boolean;
  onConnectionPullHintDismiss?: () => void;
  onPullHandlePointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  pullStarParticleCount?: number;
  isConnectionPulling?: boolean;
  /** pull 中は Bubble drag / resize を抑止 */
  suppressBubbleDrag?: boolean;
  suppressClickAfterPullRef?: React.MutableRefObject<boolean>;
  onBubbleDragStateChange?: (state: { isDragging: boolean; isResizing: boolean }) => void;
};

export function BubbleInner({
  hossii,
  currentAuthorName,
  index,
  position,
  isActive,
  onActivate,
  isSelected = false,
  onSelect,
  onPositionSave,
  onScaleSave,
  onColorSave,
  viewMode = 'full',
  canEdit = true,
  likesEnabled = false,
  onLike,
  bubbleShapePng,
  layoutAlignTopLeft = false,
  orderedStackZ,
  isRecentHighlight = false,
  animationLevel = 'full',
  isPinned = false,
  onPinToggle,
  showPinUi = false,
  canManageOwn = false,
  onOwnerDeleted,
  actionMenuEnabled = false,
  actionMenuOpen = false,
  onActionMenuToggle,
  onViewDetail,
  onConnect,
  membershipJoinStatus,
  onMembershipRetry,
  connectionCount,
  onConnectionsClick,
  connectionBadgeCount,
  isConnectionPickTarget = false,
  suppressActionMenuToggle = false,
  showPullHandle = false,
  showBubblePullHandle = false,
  showConnectionPullHint = false,
  onConnectionPullHintDismiss,
  onPullHandlePointerDown,
  pullStarParticleCount = 1,
  isConnectionPulling = false,
  suppressBubbleDrag = false,
  suppressClickAfterPullRef,
  onBubbleDragStateChange,
}: BubbleProps) {
  const { ref: visibilityRef, level: visibleAnimLevel } = useVisibleAnimationLevel(
    animationLevel,
    animationLevel !== 'none',
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      visibilityRef(node);
    },
    [visibilityRef],
  );

  // ドラッグ中のローカル状態（親 state を汚染しない）
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragScale, setDragScale] = useState<number | null>(null);

  const { currentUser } = useAuth();
  const isLoggedIn = !!currentUser;
  const [localLikeCount, setLocalLikeCount] = useState(hossii.likeCount ?? 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  // 案A: 吹き出しホバー中フラグ（0件時はホバーでのみいいねバッジを表示）
  const [isBubbleHovered, setIsBubbleHovered] = useState(false);
  /** リサイズ Phase A: 切り詰め解除して全文を吹き出し内に表示 */
  const [contentExpanded, setContentExpanded] = useState(false);
  const [showFullTextPopover, setShowFullTextPopover] = useState(false);
  const [fullTextAnchorRect, setFullTextAnchorRect] = useState<DOMRect | null>(null);
  const bubbleTextRef = useRef<HTMLParagraphElement>(null);
  const fullTextLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type LikeParticle = { id: string; emoji: string; tx: number };
  const [likeParticles, setLikeParticles] = useState<LikeParticle[]>([]);

  // I: 画像ライトボックス
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wasDraggingRef = useRef(false);
  const [actionMenuAnchorRect, setActionMenuAnchorRect] = useState<DOMRect | null>(null);

  // hossii.likeCount が外部から変わった場合（初回フェッチ完了後など）に同期
  useEffect(() => {
    const count = hossii.likeCount ?? 0;
    queueMicrotask(() => setLocalLikeCount(count));
  }, [hossii.likeCount]);

  // I: ライトボックス表示中の Escape キーで閉じる
  useEffect(() => {
    if (!lightboxSrc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightboxSrc]);

  // stale closure 回避用 ref
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragScaleRef = useRef<number | null>(null);
  const positionRef = useRef(position);
  const isSelectedRef = useRef(isSelected);
  const onSelectRef = useRef(onSelect);
  const onPositionSaveRef = useRef(onPositionSave);
  const onScaleSaveRef = useRef(onScaleSave);
  const onColorSaveRef = useRef(onColorSave);
  const canEditRef = useRef(canEdit);
  const suppressBubbleDragRef = useRef(suppressBubbleDrag);
  const hossiiRef = useRef(hossii);
  useLayoutEffect(() => {
    positionRef.current = position;
    isSelectedRef.current = isSelected;
    onSelectRef.current = onSelect;
    onPositionSaveRef.current = onPositionSave;
    onScaleSaveRef.current = onScaleSave;
    onColorSaveRef.current = onColorSave;
    canEditRef.current = canEdit;
    suppressBubbleDragRef.current = suppressBubbleDrag;
    hossiiRef.current = hossii;
  });

  // ドラッグセッション管理
  const dragStateRef = useRef<{
    mode: 'moving' | 'resizing';
    corner: ResizeCorner;
    startPX: number;
    startPY: number;
    startBX: number;
    startBY: number;
    startScale: number;
    moved: boolean;
  } | null>(null);

  const displayPos = dragPos ?? position;
  const displayScale = dragScale ?? (hossii.scale ?? 1.0);

  useLayoutEffect(() => {
    if (!actionMenuEnabled || !actionMenuOpen || !containerRef.current) {
      setActionMenuAnchorRect(null);
      return;
    }
    setActionMenuAnchorRect(containerRef.current.getBoundingClientRect());
  }, [
    actionMenuEnabled,
    actionMenuOpen,
    displayPos.x,
    displayPos.y,
    displayScale,
    isDragging,
    contentExpanded,
  ]);

  const { offset: landscapeClampOffset, isLandscape: isCustomLandscape } =
    useCustomBubbleLandscapeClamp(containerRef, [
      displayPos.x,
      displayPos.y,
      displayScale,
      contentExpanded,
      viewMode,
      hossii.imageUrl,
      hossii.message,
      layoutAlignTopLeft,
      orderedStackZ,
      isSelected,
      isDragging,
    ]);

  // native pointer event で確実にキャプチャ
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      // 本人操作バー（編集/公開範囲/削除）上の操作はドラッグ・選択に干渉させない。
      // preventDefault で click が潰れないよう、ここで早期 return する。
      if ((e.target as HTMLElement).closest('[data-owner-actions]')) return;
      if ((e.target as HTMLElement).closest('[data-bubble-action-menu]')) return;
      if ((e.target as HTMLElement).closest('[data-connection-pull-handle]')) return;

      // pull 中 / 排他時は drag 開始しない
      if (suppressBubbleDragRef.current) return;

      // 未選択 → 選択のみ（ドラッグは次のクリックから）
      if (!isSelectedRef.current) {
        onSelectRef.current?.(hossiiRef.current.id);
        return;
      }

      // 編集権限がない場合はドラッグ開始しない
      if (!canEditRef.current) return;

      // コーナーハンドルかどうかで mode 判定
      const target = e.target as HTMLElement;
      const isResizeHandle = !!target.closest('[data-resize-handle]');

      e.preventDefault();
      e.stopPropagation();

      dragStateRef.current = {
        mode: isResizeHandle ? 'resizing' : 'moving',
        corner: isResizeHandle ? getCornerFromTarget(target) : 'BR',
        startPX: e.clientX,
        startPY: e.clientY,
        startBX: positionRef.current.x,
        startBY: positionRef.current.y,
        startScale: hossiiRef.current.scale ?? 1.0,
        moved: false,
      };

      if (isResizeHandle) {
        const full = getHossiiBubbleFullText(hossiiRef.current);
        const displayed = truncateBubbleDisplayText(full, MAX_BUBBLE_TEXT_LENGTH);
        const truncated = isHossiiTextTruncated(
          full,
          displayed,
          bubbleTextRef.current,
        );
        if (truncated) {
          setContentExpanded(true);
        }
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    return () => el.removeEventListener('pointerdown', onPointerDown);
  }, [hossii.id]);

  // document レベルで pointermove/pointerup を捕捉（要素外に出てもドラッグ継続）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

      const onPointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current) return;
      const { mode, startPX, startPY, startBX, startBY, startScale } = dragStateRef.current;
      const dx = e.clientX - startPX;
      const dy = e.clientY - startPY;
      if (!dragStateRef.current.moved && !exceedsBubbleDragThreshold(dx, dy)) return;

      if (!dragStateRef.current.moved) {
        dragStateRef.current.moved = true;
        wasDraggingRef.current = true;
        setIsDragging(true);
        onBubbleDragStateChange?.({
          isDragging: dragStateRef.current.mode === 'moving',
          isResizing: dragStateRef.current.mode === 'resizing',
        });
      }

      if (mode === 'moving') {
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
      } else {
        // リサイズ: 各コーナーから「外側」へ引くと拡大
        const { corner } = dragStateRef.current;
        const dX = dx; // 右が正
        const dY = dy; // 下が正
        const signX = (corner === 'TL' || corner === 'BL') ? -1 : 1;
        const signY = (corner === 'TL' || corner === 'TR') ? -1 : 1;
        const delta = (signX * dX + signY * dY) / 2;
        const newScale = Math.max(0.5, Math.min(2.5, startScale + delta * 0.006));
        dragScaleRef.current = newScale;
        setDragScale(newScale);
      }
    };

    const onPointerUp = () => {
      if (!dragStateRef.current) return;
      const { mode, moved } = dragStateRef.current;

      if (moved) {
        if (mode === 'moving' && dragPosRef.current) {
          onPositionSaveRef.current?.(
            hossiiRef.current.id,
            dragPosRef.current.x,
            dragPosRef.current.y
          );
        } else if (mode === 'resizing' && dragScaleRef.current !== null) {
          onScaleSaveRef.current?.(hossiiRef.current.id, dragScaleRef.current);
        }
      }

      dragStateRef.current = null;
      dragPosRef.current = null;
      dragScaleRef.current = null;
      setDragPos(null);
      setDragScale(null);
      setIsDragging(false);
      setContentExpanded(false);
      if (moved) {
        onBubbleDragStateChange?.({ isDragging: false, isResizing: false });
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
  }, [hossii.id, onBubbleDragStateChange]);

  const fullText = getHossiiBubbleFullText(hossii);
  const isLaughter = hossii.autoType === 'laughter';
  const isCanvasPost = hossii.postKind === 'canvas' && !!hossii.imageUrl;

  const bubbleText = isLaughter
    ? ''
    : contentExpanded
      ? fullText
      : truncateBubbleDisplayText(fullText, MAX_BUBBLE_TEXT_LENGTH);

  const scheduleHideFullText = useCallback(() => {
    if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
    fullTextLeaveTimerRef.current = setTimeout(() => {
      setShowFullTextPopover(false);
      setFullTextAnchorRect(null);
    }, 100);
  }, []);

  const showFullTextIfTruncated = useCallback(() => {
    if (!containerRef.current || !fullText || contentExpanded) return;
    const truncated = isHossiiTextTruncated(
      fullText,
      bubbleText,
      bubbleTextRef.current,
    );
    if (!truncated) return;
    if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
    setFullTextAnchorRect(containerRef.current.getBoundingClientRect());
    setShowFullTextPopover(true);
  }, [fullText, bubbleText, contentExpanded]);

  useEffect(() => {
    return () => {
      if (fullTextLeaveTimerRef.current) clearTimeout(fullTextLeaveTimerRef.current);
    };
  }, []);

  const emoji = isLaughter
    ? '😂'
    : hossii.logType === 'speech' || hossii.autoType === 'speech'
      ? '🎙'
      : hossii.emotion
        ? EMOJI_BY_EMOTION[hossii.emotion]
        : '🌟';

  const relativeTime = getRelativeTime(hossii.createdAt);
  // Phase 2C: 現在名を主表示、投稿時名と異なれば「投稿時：旧名」を補足。
  const authorDisplay = resolvePostAuthorDisplay({
    postedName: hossii.authorName,
    currentName: currentAuthorName,
    isOwnPost: false,
  });
  const authorName = authorDisplay.primaryName || undefined;

  const animationDelay = `${(index % 8) * 0.5}s`;
  const animationDuration = `${4 + (index % 3)}s`;

  // フッターメタの表示制御（bubble モードでは非表示）
  const hashtags = hossii.hashtags ?? [];
  const MAX_VISIBLE_TAGS = 2;
  const visibleTags = hashtags.slice(0, MAX_VISIBLE_TAGS);
  const extraTagCount = hashtags.length - MAX_VISIBLE_TAGS;
  const showFooterMeta = viewMode !== 'bubble' && !isCanvasPost;

  const bubbleStyle: React.CSSProperties & {
    '--bubble-stack'?: number;
    '--bubble-bg'?: string;
    '--bubble-bg-hover'?: string;
    '--bubble-border'?: string;
    '--bubble-clamp-x'?: string;
    '--bubble-clamp-y'?: string;
  } = {
    left: `${displayPos.x}%`,
    top: `${displayPos.y}%`,
    animationDelay: isDragging ? '0s' : animationDelay,
    animationDuration,
    animationPlayState: isDragging || isSelected || layoutAlignTopLeft ? 'paused' : 'running',
  };
  if (isCustomLandscape) {
    bubbleStyle['--bubble-clamp-x'] = `${landscapeClampOffset.x}px`;
    bubbleStyle['--bubble-clamp-y'] = `${landscapeClampOffset.y}px`;
  }
  if (orderedStackZ != null) {
    bubbleStyle['--bubble-stack'] = orderedStackZ;
  }
  if (!isCanvasPost) {
    const fillColor = hossii.bubbleColor ?? '#fffbeb';
    bubbleStyle['--bubble-bg'] = withBubbleAlpha(fillColor, BUBBLE_BG_ALPHA);
    bubbleStyle['--bubble-bg-hover'] = withBubbleAlpha(fillColor, BUBBLE_BG_ALPHA_HOVER);
    if (hossii.bubbleColor) {
      bubbleStyle['--bubble-border'] = withBubbleAlpha(hossii.bubbleColor, BUBBLE_BG_ALPHA_HOVER);
    }
  }
  if (!isCanvasPost && bubbleShapePng) {
    // PNG はオーバーレイ <img> で描画。背景色は CSS 変数で半透明フィルとして残す。
    bubbleStyle.borderRadius = '0';
    bubbleStyle.border = 'none';
    bubbleStyle.boxShadow = 'none';
  }
  if (displayScale !== 1.0) {
    if (isCanvasPost) {
      bubbleStyle.maxWidth = `min(${200 * displayScale}px, ${30 * displayScale}vw)`;
    } else if (bubbleShapePng) {
      const size = 190 * displayScale;
      bubbleStyle.width = `${size}px`;
      bubbleStyle.maxWidth = `${size}px`;
      bubbleStyle.minHeight = `${size}px`;
    } else {
      bubbleStyle.maxWidth = `${240 * displayScale}px`;
    }
  }

  const textLineClamp = contentExpanded
    ? undefined
    : bubbleLineClampForScale(viewMode, displayScale);

  const classNames = [
    styles.bubble,
    isCustomLandscape ? styles.bubbleLandscapeCompact : '',
    isCustomLandscape ? styles.bubbleLandscapeClamp : '',
    visibleAnimLevel === 'none' ? styles.bubbleAnimNone : '',
    visibleAnimLevel === 'light' ? styles.bubbleAnimLight : '',
    isCanvasPost ? styles.bubbleCanvas : '',
    !isCanvasPost && bubbleShapePng ? styles.bubbleCustomShape : '',
    layoutAlignTopLeft ? styles.bubbleLayoutGrid : '',
    !layoutAlignTopLeft && orderedStackZ != null ? styles.bubbleStack : '',
    isActive && !isSelected ? styles.bubbleActive : '',
    isSelected
      ? isCanvasPost
        ? styles.bubbleSelected
        : bubbleShapePng
          ? styles.bubbleSelectedShape
          : styles.bubbleSelected
      : isConnectionPickTarget
        ? styles.bubbleConnectionPickTarget
        : '',
    dragPos ? styles.bubbleDragging : '',
    isRecentHighlight &&
      (isCanvasPost
        ? styles.bubbleRecentGlow
        : bubbleShapePng
          ? styles.bubbleRecentGlowShape
          : styles.bubbleRecentGlow),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
    <div
      ref={mergeContainerRef}
      className={classNames}
      style={bubbleStyle}
      data-hossii-bubble
      data-hossii-id={hossii.id}
      data-hossii-post-kind={isCanvasPost ? 'canvas' : 'bubble'}
      onClick={() => {
        if (wasDraggingRef.current || isDragging || suppressClickAfterPullRef?.current) return;
        if (!isSelected) {
          onSelect?.(hossii.id);
          return;
        }
        if (actionMenuEnabled && !suppressActionMenuToggle) {
          onActionMenuToggle?.();
          return;
        }
        onActivate();
      }}
      onMouseEnter={() => {
        if (!isSelected) onActivate();
        setIsBubbleHovered(true);
      }}
      onMouseLeave={() => setIsBubbleHovered(false)}
    >
      {connectionBadgeCount != null && connectionBadgeCount > 0 && (
        <span
          className={styles.connectionBadge}
          data-connection-badge
          aria-hidden
        >
          ✦{connectionBadgeCount}
        </span>
      )}
      {isSelected && showBubblePullHandle && onPullHandlePointerDown && (
        <button
          type="button"
          className={`${styles.bubblePullHandle} ${isConnectionPulling ? styles.bubblePullHandleActive : ''}`}
          data-connection-pull-handle
          data-bubble-pull-handle
          data-space-export="exclude"
          aria-label="つながりを引っ張る"
          onPointerDown={(e) => {
            e.stopPropagation();
            onPullHandlePointerDown(e);
          }}
        >
          <span className={styles.bubblePullHandleIcon} aria-hidden>
            ✦
          </span>
        </button>
      )}
      {isSelected && showConnectionPullHint && (
        <div
          className={styles.connectionPullHint}
          role="status"
          data-space-export="exclude"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={styles.connectionPullHintText}>
            ✦を引っ張ると、つながりが見えるよ
          </span>
          {onConnectionPullHintDismiss && (
            <button
              type="button"
              className={styles.connectionPullHintDismiss}
              aria-label="閉じる"
              onClick={(e) => {
                e.stopPropagation();
                onConnectionPullHintDismiss();
              }}
            >
              ×
            </button>
          )}
        </div>
      )}
      {showPinUi && onPinToggle && (isBubbleHovered || isPinned) && (
        <PinButton
          className={styles.bubblePinButton}
          isPinned={isPinned}
          visible={isBubbleHovered || isPinned}
          onToggle={() => onPinToggle(hossii.id)}
        />
      )}

      {/* B02: 形状 PNG をフレームとしてオーバーレイ表示 */}
      {!isCanvasPost && bubbleShapePng && (
        <img
          src={bubbleShapePng}
          className={styles.bubbleShapeOverlay}
          alt=""
          draggable={false}
        />
      )}

      <div
        className={[
          styles.bubbleInner,
          !isCanvasPost && bubbleShapePng ? styles.bubbleInnerShaped : '',
          isCanvasPost ? styles.bubbleInnerCanvas : '',
          !isCanvasPost ? styles.bubbleInnerV2 : '',
        ].filter(Boolean).join(' ')}
        onMouseEnter={() => {
          showFullTextIfTruncated();
        }}
        onMouseLeave={() => {
          scheduleHideFullText();
        }}
      >
        {isCanvasPost ? (
          viewMode === 'image' ? (
            <div className={styles.bubbleCanvasImageWrap}>
              <img
                src={hossii.imageUrl}
                alt={hossii.message?.trim() ? hossii.message : 'フリー投稿'}
                className={styles.bubbleCanvasImage}
                loading="lazy"
                title="ダブルクリックで拡大表示"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setLightboxSrc(hossii.imageUrl!);
                }}
              />
              {isSelected && (
                <button
                  type="button"
                  className={styles.canvasExpandBtn}
                  data-space-export="exclude"
                  aria-label="拡大表示"
                  title="拡大表示"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxSrc(hossii.imageUrl!);
                  }}
                >
                  🔍
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={styles.bubbleCanvasImageWrap}>
                <img
                  src={hossii.imageUrl}
                  alt={hossii.message?.trim() ? hossii.message : 'フリー投稿'}
                  className={styles.bubbleCanvasImage}
                  loading="lazy"
                  title="ダブルクリックで拡大表示"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setLightboxSrc(hossii.imageUrl!);
                  }}
                />
                {isSelected && (
                  <button
                    type="button"
                    className={styles.canvasExpandBtn}
                    data-space-export="exclude"
                    aria-label="拡大表示"
                    title="拡大表示"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxSrc(hossii.imageUrl!);
                    }}
                  >
                    🔍
                  </button>
                )}
              </div>
              <div className={styles.bubbleCanvasMeta}>
                <span className={styles.bubbleMetaText}>{authorName ? `${authorName} · ${relativeTime}` : relativeTime}</span>
                <PostedNameLabel name={authorDisplay.postedNameLabel} />
              </div>
            </>
          )
        ) : viewMode === 'image' ? (
          hossii.imageUrl ? (
            <img
              src={hossii.imageUrl}
              alt="投稿画像"
              className={styles.bubbleImage}
              loading="lazy"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setLightboxSrc(hossii.imageUrl!); }}
            />
          ) : null
        ) : (
          <>
            {/* v2 ヘッダー行: 絵文字 + ニックネーム */}
            <div className={styles.bubbleHeader}>
              <span className={styles.bubbleEmoji}>{emoji}</span>
              {authorName && (
                <span className={styles.bubbleNickname}>{authorName}</span>
              )}
              <PostedNameLabel name={authorDisplay.postedNameLabel} />
            </div>
            {/* コメント本文 */}
            {bubbleText && (
              <p
                ref={bubbleTextRef}
                className={[
                  styles.bubbleText,
                  contentExpanded ? styles.bubbleTextExpanded : '',
                ].filter(Boolean).join(' ')}
                style={
                  textLineClamp != null
                    ? ({ WebkitLineClamp: textLineClamp } as React.CSSProperties)
                    : undefined
                }
              >
                {bubbleText}
              </p>
            )}
            {viewMode === 'full' && hossii.imageUrl && (
              <img
                src={hossii.imageUrl}
                alt="投稿画像"
                className={styles.bubbleImage}
                loading="lazy"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setLightboxSrc(hossii.imageUrl!); }}
              />
            )}
            {viewMode === 'full' && hossii.numberValue != null && (
              <p className={styles.bubbleNumber}>📊 {hossii.numberValue}</p>
            )}
          </>
        )}
      </div>

      {/* フッターメタ行: 時刻 + タグ（bubble モード以外） */}
      {showFooterMeta && (
        <div className={styles.bubbleFooterMeta}>
          <span className={styles.bubbleTimeText}>{relativeTime}</span>
          {visibleTags.map((tag) => (
            <span key={tag} className={styles.bubbleHashtag}>#{tag}</span>
          ))}
          {extraTagCount > 0 && (
            <span className={styles.bubbleHashtagMore}>+{extraTagCount}</span>
          )}
        </div>
      )}

      {/* フローティングいいねバッジ（吹き出し外側右下）
          0件: ホバー時のみ表示（案A）、1件以上: 常時表示 */}
      {likesEnabled && (localLikeCount > 0 || isBubbleHovered) && (
        <div
          data-like-badge
          className={[
            styles.likeFloatingBadge,
            isLiked ? styles.likeFloatingBadgeActive : '',
            isBouncing ? styles.likeFloatingBadgeBouncing : '',
            localLikeCount === 0 ? styles.likeFloatingBadgeGhost : '',
          ].filter(Boolean).join(' ')}
        >
          {likeParticles.map((p) => (
            <span
              key={p.id}
              className={styles.likeParticle}
              style={{ '--tx': `${p.tx}px` } as React.CSSProperties}
            >
              {p.emoji}
            </span>
          ))}
          <button
            className={styles.likeFloatingBtn}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={async (e) => {
              e.stopPropagation();
              if (isBouncing || likePending || !onLike) return;
              const prevCount = localLikeCount;
              const prevLiked = isLiked;
              const preview = previewOptimisticLikeState({
                isLoggedIn,
                wasLiked: isLiked,
                baseCount: localLikeCount,
              });
              setLocalLikeCount(preview.count);
              setIsLiked(preview.liked);
              setLikeError(null);
              setLikePending(true);
              try {
                const result = await onLike(hossii.id);
                setLocalLikeCount(result.likeCount);
                setIsLiked(result.liked);
                if (result.liked) {
                  setIsBouncing(true);
                  setTimeout(() => setIsBouncing(false), 450);
                  const LIKE_EMOJIS = ['❤️', '💛', '⭐', '✨'];
                  const count = 3 + Math.floor(Math.random() * 3);
                  const particles: LikeParticle[] = Array.from({ length: count }, (_, i) => ({
                    id: `${Date.now()}-${i}`,
                    emoji: LIKE_EMOJIS[Math.floor(Math.random() * LIKE_EMOJIS.length)],
                    tx: Math.round((Math.random() - 0.5) * 40),
                  }));
                  setLikeParticles(particles);
                  setTimeout(() => setLikeParticles([]), 750);
                }
              } catch {
                setLocalLikeCount(prevCount);
                setIsLiked(prevLiked);
                setLikeError(LIKE_MUTATION_ERROR_MESSAGE);
              } finally {
                setLikePending(false);
              }
            }}
            aria-label="いいね"
          >
            {isLiked ? '❤️' : '🤍'}{localLikeCount > 0 && <span>{localLikeCount}</span>}
          </button>
          {likeError && (
            <span className={styles.likeFloatingError} role="alert">
              {likeError}
            </span>
          )}
        </div>
      )}

      {/* 本人操作バー: 自分の吹き出しを選択したとき、吹き出し直下に編集/公開範囲/削除を出す。
          位置編集(canEdit)とは独立して常に到達可能にする。 */}
      {actionMenuAnchorRect && actionMenuEnabled && actionMenuOpen && (
        <BubbleActionMenu
          anchorRect={actionMenuAnchorRect}
          onViewDetail={onViewDetail}
          onConnect={onConnect}
          membershipJoinStatus={membershipJoinStatus}
          onMembershipRetry={onMembershipRetry}
          connectionCount={connectionCount}
          onConnectionsClick={onConnectionsClick}
          showPullHandle={showPullHandle}
          onPullHandlePointerDown={onPullHandlePointerDown}
          pullStarParticleCount={pullStarParticleCount}
          isPulling={isConnectionPulling}
        />
      )}

      {isSelected && canManageOwn && (
        <div
          className={styles.bubbleOwnerBar}
          data-owner-actions
          data-space-export="exclude"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {hossii.visibility === 'owner_only' && <OwnerOnlyBadge />}
          <OwnPostActions
            hossii={hossii}
            variant="bar"
            onDeleted={onOwnerDeleted}
          />
        </div>
      )}

      {/* 選択時: 4コーナーのリサイズハンドル + カラーパレット（編集権限がある場合のみ） */}
      {isSelected && canEdit && (
        <>
          <div className={`${styles.resizeHandle} ${styles.resizeHandleTL}`} data-resize-handle="TL" />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleTR}`} data-resize-handle="TR" />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleBL}`} data-resize-handle="BL" />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleBR}`} data-resize-handle="BR" />

          {!isCanvasPost && (
            <div
              className={styles.bubbleColorPalette}
              data-space-export="exclude"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {BUBBLE_COLORS.map((color) => (
                <button
                  key={color}
                  className={`${styles.bubbleColorSwatch} ${hossii.bubbleColor === color ? styles.bubbleColorSwatchActive : ''}`}
                  style={{ backgroundColor: withBubbleAlpha(color) }}
                  title={color}
                  onClick={() => {
                    onColorSaveRef.current?.(hossii.id, color);
                  }}
                />
              ))}
              <button
                className={`${styles.bubbleColorSwatch} ${styles.bubbleColorSwatchClear} ${!hossii.bubbleColor ? styles.bubbleColorSwatchActive : ''}`}
                title="デフォルト"
                onClick={() => {
                  onColorSaveRef.current?.(hossii.id, null);
                }}
              >
                ✕
              </button>
            </div>
          )}
        </>
      )}
    </div>

    {lightboxSrc && createPortal(
      <div
        className={styles.lightboxOverlay}
        onClick={() => setLightboxSrc(null)}
      >
        <img
          src={lightboxSrc}
          alt="拡大表示"
          className={styles.lightboxImage}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className={styles.lightboxClose}
          onClick={() => setLightboxSrc(null)}
          aria-label="閉じる"
        >✕</button>
      </div>,
      document.body
    )}

    {showFullTextPopover && fullTextAnchorRect && (
      <HossiiFullTextPopover
        hossii={hossii}
        anchorRect={fullTextAnchorRect}
        variant="bubble"
      />
    )}
    </>
  );
}

function bubblePropsEqual(prev: BubbleProps, next: BubbleProps): boolean {
  return (
    prev.hossii === next.hossii &&
    prev.currentAuthorName === next.currentAuthorName &&
    prev.position.x === next.position.x &&
    prev.position.y === next.position.y &&
    prev.animationLevel === next.animationLevel &&
    prev.isActive === next.isActive &&
    prev.isSelected === next.isSelected &&
    prev.viewMode === next.viewMode &&
    prev.index === next.index &&
    prev.orderedStackZ === next.orderedStackZ &&
    prev.isRecentHighlight === next.isRecentHighlight &&
    prev.isPinned === next.isPinned &&
    prev.showPinUi === next.showPinUi &&
    prev.canManageOwn === next.canManageOwn &&
    prev.onOwnerDeleted === next.onOwnerDeleted &&
    prev.onPinToggle === next.onPinToggle &&
    prev.onActivate === next.onActivate &&
    prev.onSelect === next.onSelect &&
    prev.actionMenuEnabled === next.actionMenuEnabled &&
    prev.actionMenuOpen === next.actionMenuOpen &&
    prev.onActionMenuToggle === next.onActionMenuToggle &&
    prev.onViewDetail === next.onViewDetail &&
    prev.onConnect === next.onConnect &&
    prev.membershipJoinStatus === next.membershipJoinStatus &&
    prev.onMembershipRetry === next.onMembershipRetry &&
    prev.connectionCount === next.connectionCount &&
    prev.onConnectionsClick === next.onConnectionsClick &&
    prev.connectionBadgeCount === next.connectionBadgeCount &&
    prev.isConnectionPickTarget === next.isConnectionPickTarget &&
    prev.suppressActionMenuToggle === next.suppressActionMenuToggle &&
    prev.showPullHandle === next.showPullHandle &&
    prev.showBubblePullHandle === next.showBubblePullHandle &&
    prev.showConnectionPullHint === next.showConnectionPullHint &&
    prev.onConnectionPullHintDismiss === next.onConnectionPullHintDismiss &&
    prev.onPullHandlePointerDown === next.onPullHandlePointerDown &&
    prev.pullStarParticleCount === next.pullStarParticleCount &&
    prev.isConnectionPulling === next.isConnectionPulling &&
    prev.suppressBubbleDrag === next.suppressBubbleDrag &&
    prev.suppressClickAfterPullRef === next.suppressClickAfterPullRef &&
    prev.onBubbleDragStateChange === next.onBubbleDragStateChange
  );
}

export const Bubble = memo(BubbleInner, bubblePropsEqual);

// 後方互換のため Tree も export
export const Tree = Bubble;
