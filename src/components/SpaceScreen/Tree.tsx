import { useRef, useEffect, useState } from 'react';
import type { Hossii } from '../../core/types';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import type { ViewMode } from '../../core/utils/displayPrefsStorage';
import styles from './SpaceScreen.module.css';

const BUBBLE_COLORS = [
  '#FFB3B3', // 淡いレッド
  '#FFD9B3', // 淡いオレンジ
  '#FFFAB3', // 淡いイエロー
  '#B3FFB8', // 淡いグリーン
  '#B3E0FF', // 淡いブルー
  '#D9B3FF', // 淡いパープル
  '#FFB3E6', // 淡いピンク
  '#FFFFFF', // ホワイト
];

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

const MAX_BUBBLE_TEXT_LENGTH = 40;
function truncateText(text: string): string {
  if (text.length <= MAX_BUBBLE_TEXT_LENGTH) return text;
  return text.slice(0, MAX_BUBBLE_TEXT_LENGTH) + '…';
}

// BubbleEditMode は外部で参照されないが後方互換のため残す
export type BubbleEditMode = 'none' | 'moving' | 'resizing';

type BubbleProps = {
  hossii: Hossii;
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
  /** likes_enabled Feature Flag が ON の場合のみ true */
  likesEnabled?: boolean;
  /** いいねトグル時のコールバック（楽観的更新は Bubble 内で行い、Supabase 処理は親で行う） */
  onLike?: (id: string) => void;
};

export const Bubble = ({
  hossii,
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
}: BubbleProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // ドラッグ中のローカル状態（親 state を汚染しない）
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragScale, setDragScale] = useState<number | null>(null);

  // いいねのローカル楽観的状態
  const [localLikedByMe, setLocalLikedByMe] = useState(hossii.likedByMe ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(hossii.likeCount ?? 0);

  // hossii.likedByMe が外部から変わった場合（初回フェッチ完了後など）に同期
  useEffect(() => {
    setLocalLikedByMe(hossii.likedByMe ?? false);
    setLocalLikeCount(hossii.likeCount ?? 0);
  }, [hossii.likedByMe, hossii.likeCount]);

  // stale closure 回避用 ref
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragScaleRef = useRef<number | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  const isSelectedRef = useRef(isSelected);
  isSelectedRef.current = isSelected;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPositionSaveRef = useRef(onPositionSave);
  onPositionSaveRef.current = onPositionSave;
  const onScaleSaveRef = useRef(onScaleSave);
  onScaleSaveRef.current = onScaleSave;
  const onColorSaveRef = useRef(onColorSave);
  onColorSaveRef.current = onColorSave;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const hossiiRef = useRef(hossii);
  hossiiRef.current = hossii;

  // ドラッグセッション管理
  const dragStateRef = useRef<{
    mode: 'moving' | 'resizing';
    startPX: number;
    startPY: number;
    startBX: number;
    startBY: number;
    startScale: number;
    moved: boolean;
  } | null>(null);

  const displayPos = dragPos ?? position;
  const displayScale = dragScale ?? (hossii.scale ?? 1.0);

  // native pointer event で確実にキャプチャ
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
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
        startPX: e.clientX,
        startPY: e.clientY,
        startBX: positionRef.current.x,
        startBY: positionRef.current.y,
        startScale: hossiiRef.current.scale ?? 1.0,
        moved: false,
      };
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
      dragStateRef.current.moved = true;

      if (mode === 'moving') {
        const area = el.closest('[data-bubble-area]') as HTMLElement | null;
        const areaW = area?.clientWidth ?? window.innerWidth;
        const areaH = area?.clientHeight ?? window.innerHeight;
        const dX = ((e.clientX - startPX) / areaW) * 100;
        const dY = ((e.clientY - startPY) / areaH) * 100;
        const newPos = {
          x: Math.max(5, Math.min(95, startBX + dX)),
          y: Math.max(5, Math.min(90, startBY + dY)),
        };
        dragPosRef.current = newPos;
        setDragPos({ ...newPos });
      } else {
        // リサイズ: 右下方向に大きく = 拡大
        const dX = e.clientX - startPX;
        const dY = startPY - e.clientY; // 上に行くほど大きく
        const delta = (dX + dY) / 2;
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
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [hossii.id]);

  const displayText = renderHossiiText(hossii);
  const isLaughter = hossii.autoType === 'laughter';

  const emoji = isLaughter
    ? '😂'
    : hossii.logType === 'speech' || hossii.autoType === 'speech'
      ? '🎙'
      : hossii.emotion
        ? EMOJI_BY_EMOTION[hossii.emotion]
        : '🌟';

  // bubbleEmoji スパンが絵文字を表示するため、bubbleText は emoji を含まない message のみ使用
  const bubbleText = isLaughter
    ? ''
    : hossii.logType === 'speech' || hossii.autoType === 'speech'
      ? truncateText(displayText)
      : truncateText((hossii.message ?? '').trim());

  const relativeTime = getRelativeTime(hossii.createdAt);
  const authorName = hossii.authorName;
  const metaText = authorName ? `${authorName} · ${relativeTime}` : relativeTime;

  const animationDelay = `${(index % 8) * 0.5}s`;
  const animationDuration = `${4 + (index % 3)}s`;

  const isDragging = dragStateRef.current?.moved ?? false;

  const bubbleStyle: React.CSSProperties = {
    left: `${displayPos.x}%`,
    top: `${displayPos.y}%`,
    animationDelay: isDragging ? '0s' : animationDelay,
    animationDuration,
    animationPlayState: isDragging || isSelected ? 'paused' : 'running',
  };
  if (hossii.bubbleColor) {
    bubbleStyle.backgroundColor = hossii.bubbleColor;
    bubbleStyle.borderColor = hossii.bubbleColor;
  }
  if (displayScale !== 1.0) {
    bubbleStyle.scale = String(displayScale);
  }

  const classNames = [
    styles.bubble,
    isActive && !isSelected ? styles.bubbleActive : '',
    isSelected ? styles.bubbleSelected : '',
    dragPos ? styles.bubbleDragging : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={classNames}
      style={bubbleStyle}
      data-hossii-bubble
      onClick={() => {
        if (!dragStateRef.current?.moved) {
          if (!isSelected) onSelect?.(hossii.id);
          else onActivate();
        }
      }}
      onMouseEnter={() => {
        if (!isSelected) onActivate();
      }}
    >
      <div className={styles.bubbleInner}>
        {/* --- viewMode: image → 画像のみ --- */}
        {viewMode === 'image' ? (
          hossii.imageUrl ? (
            <img src={hossii.imageUrl} alt="投稿画像" className={styles.bubbleImage} loading="lazy" />
          ) : null
        ) : (
          <>
            <span className={styles.bubbleEmoji}>{emoji}</span>
            <div className={styles.bubbleContent}>
              {/* bubble モードでは meta（投稿者名/時間）のみ、full では全要素 */}
              <div className={styles.bubbleMeta}>
                <span className={styles.bubbleMetaText}>{metaText}</span>
              </div>
              {viewMode === 'full' && bubbleText && (
                <p className={styles.bubbleText}>{bubbleText}</p>
              )}
              {viewMode === 'full' && hossii.imageUrl && (
                <img
                  src={hossii.imageUrl}
                  alt="投稿画像"
                  className={styles.bubbleImage}
                  loading="lazy"
                />
              )}
              {viewMode === 'full' && hossii.numberValue != null && (
                <p className={styles.bubbleNumber}>📊 {hossii.numberValue}</p>
              )}
              {viewMode === 'full' && hossii.hashtags && hossii.hashtags.length > 0 && (
                <div className={styles.bubbleHashtags}>
                  {hossii.hashtags.map((tag) => (
                    <span key={tag} className={styles.bubbleHashtag}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {viewMode === 'full' && likesEnabled && (
                <button
                  className={`${styles.likeButton} ${localLikedByMe ? styles.likeButtonActive : ''}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newLiked = !localLikedByMe;
                    setLocalLikedByMe(newLiked);
                    setLocalLikeCount((c) => newLiked ? c + 1 : Math.max(0, c - 1));
                    onLike?.(hossii.id);
                  }}
                  aria-label={localLikedByMe ? 'いいねを取り消す' : 'いいね'}
                >
                  {localLikedByMe ? '❤️' : '🤍'} {localLikeCount > 0 && <span>{localLikeCount}</span>}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 選択時: 4コーナーのリサイズハンドル + カラーパレット（編集権限がある場合のみ） */}
      {isSelected && canEdit && (
        <>
          <div className={`${styles.resizeHandle} ${styles.resizeHandleTL}`} data-resize-handle />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleTR}`} data-resize-handle />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleBL}`} data-resize-handle />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleBR}`} data-resize-handle />

          {/* カラーパレット */}
          <div
            className={styles.bubbleColorPalette}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {BUBBLE_COLORS.map((color) => (
              <button
                key={color}
                className={`${styles.bubbleColorSwatch} ${hossii.bubbleColor === color ? styles.bubbleColorSwatchActive : ''}`}
                style={{ backgroundColor: color }}
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
        </>
      )}
    </div>
  );
};

// 後方互換のため Tree も export
export const Tree = Bubble;
