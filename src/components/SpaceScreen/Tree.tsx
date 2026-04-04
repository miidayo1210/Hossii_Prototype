import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

type ResizeCorner = 'TL' | 'TR' | 'BL' | 'BR';

function getCornerFromTarget(target: HTMLElement): ResizeCorner {
  const handle = target.closest('[data-resize-handle]') as HTMLElement | null;
  return (handle?.dataset.resizeHandle as ResizeCorner) ?? 'BR';
}

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
  /** カスタム吹き出し形状PNGのパス（指定するとmask-imageでPNG形状に切り抜かれる） */
  bubbleShapePng?: string;
  /** 投稿順レイアウト時: 左上基準でスケール・見た目を揃える */
  layoutAlignTopLeft?: boolean;
  /** 投稿順モード時のみ: 格子セル番号に応じた重ね順（大きいほど手前＝右下ほど上） */
  orderedStackZ?: number;
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
  bubbleShapePng,
  layoutAlignTopLeft = false,
  orderedStackZ,
}: BubbleProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // ドラッグ中のローカル状態（親 state を汚染しない）
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragScale, setDragScale] = useState<number | null>(null);

  // いいねのローカル楽観的状態（インクリメント専用）
  const [localLikeCount, setLocalLikeCount] = useState(hossii.likeCount ?? 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);

  type LikeParticle = { id: string; emoji: string; tx: number };
  const [likeParticles, setLikeParticles] = useState<LikeParticle[]>([]);

  // I: 画像ライトボックス
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
  const hossiiRef = useRef(hossii);
  useLayoutEffect(() => {
    positionRef.current = position;
    isSelectedRef.current = isSelected;
    onSelectRef.current = onSelect;
    onPositionSaveRef.current = onPositionSave;
    onScaleSaveRef.current = onScaleSave;
    onColorSaveRef.current = onColorSave;
    canEditRef.current = canEdit;
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
        corner: isResizeHandle ? getCornerFromTarget(target) : 'BR',
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
      if (!dragStateRef.current.moved) {
        dragStateRef.current.moved = true;
        setIsDragging(true);
      }

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
        // リサイズ: 各コーナーから「外側」へ引くと拡大
        const { corner } = dragStateRef.current;
        const dX = e.clientX - startPX; // 右が正
        const dY = e.clientY - startPY; // 下が正
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

  // フッター帯の表示制御
  const hashtags = hossii.hashtags ?? [];
  const MAX_VISIBLE_TAGS = 3;
  const visibleTags = hashtags.slice(0, MAX_VISIBLE_TAGS);
  const extraTagCount = hashtags.length - MAX_VISIBLE_TAGS;
  const showFooter = viewMode === 'full' && (hashtags.length > 0 || likesEnabled);

  const bubbleStyle: React.CSSProperties & { '--bubble-stack'?: number } = {
    left: `${displayPos.x}%`,
    top: `${displayPos.y}%`,
    animationDelay: isDragging ? '0s' : animationDelay,
    animationDuration,
    animationPlayState: isDragging || isSelected || layoutAlignTopLeft ? 'paused' : 'running',
  };
  if (orderedStackZ != null) {
    bubbleStyle['--bubble-stack'] = orderedStackZ;
  }
  if (hossii.bubbleColor) {
    bubbleStyle.backgroundColor = hossii.bubbleColor;
    bubbleStyle.borderColor = hossii.bubbleColor;
  }
  if (bubbleShapePng) {
    // PNG はオーバーレイ <img> で描画するため mask-image は使わない。
    // 背景色をフィルとして残し、border/backdrop-filter のみリセットする。
    if (!hossii.bubbleColor) {
      bubbleStyle.backgroundColor = 'rgba(255, 251, 235, 0.95)';
    }
    bubbleStyle.borderRadius = '0';
    bubbleStyle.border = 'none';
    bubbleStyle.backdropFilter = 'none';
    bubbleStyle.boxShadow = 'none';
  }
  if (displayScale !== 1.0) {
    bubbleStyle.scale = String(displayScale);
  }

  const classNames = [
    styles.bubble,
    bubbleShapePng ? styles.bubbleCustomShape : '',
    layoutAlignTopLeft ? styles.bubbleLayoutGrid : '',
    isActive && !isSelected ? styles.bubbleActive : '',
    isSelected ? (bubbleShapePng ? styles.bubbleSelectedShape : styles.bubbleSelected) : '',
    dragPos ? styles.bubbleDragging : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
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
      {/* B02: 形状 PNG をフレームとしてオーバーレイ表示 */}
      {bubbleShapePng && (
        <img
          src={bubbleShapePng}
          className={styles.bubbleShapeOverlay}
          alt=""
          draggable={false}
        />
      )}

      <div className={`${styles.bubbleInner} ${bubbleShapePng ? styles.bubbleInnerShaped : ''}`}>
        {/* --- viewMode: image → 画像のみ --- */}
        {viewMode === 'image' ? (
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
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setLightboxSrc(hossii.imageUrl!); }}
                />
              )}
              {viewMode === 'full' && hossii.numberValue != null && (
                <p className={styles.bubbleNumber}>📊 {hossii.numberValue}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* フッター帯: タグ・いいね（full モードかつ該当要素がある場合のみ） */}
      {showFooter && (
        <div className={styles.bubbleFooter}>
          <div className={styles.bubbleHashtags}>
            {visibleTags.map((tag) => (
              <span key={tag} className={styles.bubbleHashtag}>#{tag}</span>
            ))}
            {extraTagCount > 0 && (
              <span className={styles.bubbleHashtagMore}>+{extraTagCount}</span>
            )}
          </div>
          {likesEnabled && (
            <div style={{ position: 'relative' }}>
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
                className={[
                  styles.likeButton,
                  isLiked ? styles.likeButtonActive : '',
                  isBouncing ? styles.likeButtonBouncing : '',
                ].filter(Boolean).join(' ')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBouncing) return;
                  setLocalLikeCount((c) => c + 1);
                  setIsLiked(true);
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
                  onLike?.(hossii.id);
                }}
                aria-label="いいね"
              >
                ❤️ {localLikeCount > 0 && <span>{localLikeCount}</span>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 選択時: 4コーナーのリサイズハンドル + カラーパレット（編集権限がある場合のみ） */}
      {isSelected && canEdit && (
        <>
          <div className={`${styles.resizeHandle} ${styles.resizeHandleTL}`} data-resize-handle="TL" />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleTR}`} data-resize-handle="TR" />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleBL}`} data-resize-handle="BL" />
          <div className={`${styles.resizeHandle} ${styles.resizeHandleBR}`} data-resize-handle="BR" />

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
    </>
  );
};

// 後方互換のため Tree も export
export const Tree = Bubble;
