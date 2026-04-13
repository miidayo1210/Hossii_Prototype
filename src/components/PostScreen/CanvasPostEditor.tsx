import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { flushSync } from 'react-dom';
import { toPng } from 'html-to-image';
import type { AddHossiiInput } from '../../core/types';
import { generateId } from '../../core/utils';
import { uploadCanvasPostImage } from '../../core/utils/imageStorageApi';
import { isSupabaseConfigured } from '../../core/supabase';
import styles from './CanvasPostEditor.module.css';

const MAX_TEXT_BLOCKS = 10;
const MAX_TEXT_LEN = 200;

const STAGE_MIN_W = 120;
const STAGE_MIN_H = 90;
const STAGE_MAX_W = 380;
const STAGE_MAX_H = 720;
/** 既定 16:9 横長（幅基準・吹き出し投稿のプレビュー比率に寄せる） */
const STAGE_DEFAULT_W = 320;
const STAGE_DEFAULT_H = Math.round((STAGE_DEFAULT_W * 9) / 16);

type TextBlock = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontIndex: number;
};

const FONT_CLASSES = [
  styles.fontPreset0,
  styles.fontPreset1,
  styles.fontPreset2,
  styles.fontPreset3,
  styles.fontPreset4,
];

export type CanvasPostEditorProps = {
  spaceId: string;
  addHossii: (input: AddHossiiInput) => void;
  panelMode?: boolean;
  onClose?: () => void;
  onGoToSpace: () => void;
  /** 未指定ならストア側でランダム初期位置 */
  position?: { x: number; y: number } | null;
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void;
  continuousPost: boolean;
};

export type CanvasPostEditorHandle = {
  appendSpeechText: (text: string) => void;
};

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

/** テキストブロックをログ・DB の message に保存する用（仕様 69） */
function joinTextBlocksForMessage(blocks: TextBlock[]): string {
  return blocks
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export const CanvasPostEditor = forwardRef<CanvasPostEditorHandle, CanvasPostEditorProps>(
  function CanvasPostEditor(
    {
      spaceId,
      addHossii,
      panelMode,
      onClose,
      onGoToSpace,
      position,
      onToast,
      continuousPost,
    },
    ref,
  ) {
    const stageRef = useRef<HTMLDivElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const stickerInputRef = useRef<HTMLInputElement>(null);

    const [bgColor, setBgColor] = useState('#fef3c7');
    const [bgTransparent, setBgTransparent] = useState(false);
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [texts, setTexts] = useState<TextBlock[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [stickerSrc, setStickerSrc] = useState<string | null>(null);
    const [stickerPos, setStickerPos] = useState({ x: 50, y: 60 });
    const [submitting, setSubmitting] = useState(false);
    const [stageW, setStageW] = useState(STAGE_DEFAULT_W);
    const [stageH, setStageH] = useState(STAGE_DEFAULT_H);
    const dragRef = useRef<{
      kind: 'text' | 'sticker' | 'stage' | 'fontSize';
      id?: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      startW?: number;
      startH?: number;
      startFontSize?: number;
      /** テキスト: ドラッグとみなすほどポインタが動いたか（未動ならタップ＝編集） */
      textMovedBeyondThreshold?: boolean;
    } | null>(null);

    const selected = texts.find((t) => t.id === selectedId) ?? null;
    const editingContentRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      if (!editingTextId) return;
      const el = editingContentRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, [editingTextId]);

    useImperativeHandle(
      ref,
      () => ({
        appendSpeechText: (raw: string) => {
          const t = raw.trim().slice(0, MAX_TEXT_LEN);
          if (!t) return;
          const id = generateId();
          setTexts((prev) => {
            if (prev.length >= MAX_TEXT_BLOCKS) {
              onToast({
                message: `テキストは最大${MAX_TEXT_BLOCKS}個までだよ`,
                type: 'error',
              });
              return prev;
            }
            return [
              ...prev,
              {
                id,
                text: t,
                x: 50,
                y: 45,
                fontSize: 20,
                color: '#1e293b',
                fontIndex: 0,
              },
            ];
          });
          setSelectedId(id);
          setEditingTextId(null);
        },
      }),
      [onToast],
    );

    useEffect(() => {
      const onMove = (e: PointerEvent) => {
        const d = dragRef.current;
        const stage = stageRef.current;
        if (!d || !stage) return;
        const rect = stage.getBoundingClientRect();
        if (d.kind === 'stage' && d.startW != null && d.startH != null) {
          const dw = e.clientX - d.startClientX;
          const dh = e.clientY - d.startClientY;
          setStageW(clamp(d.startW + dw, STAGE_MIN_W, STAGE_MAX_W));
          setStageH(clamp(d.startH + dh, STAGE_MIN_H, STAGE_MAX_H));
          return;
        }
        if (d.kind === 'fontSize' && d.id && d.startFontSize != null) {
          const dy = e.clientY - d.startClientY;
          const next = clamp(Math.round(d.startFontSize - dy * 0.15), 12, 48);
          setTexts((prev) =>
            prev.map((t) => (t.id === d.id ? { ...t, fontSize: next } : t)),
          );
          return;
        }
        const dx = ((e.clientX - d.startClientX) / rect.width) * 100;
        const dy = ((e.clientY - d.startClientY) / rect.height) * 100;
        const nx = Math.max(0, Math.min(100, d.startX + dx));
        const ny = Math.max(0, Math.min(100, d.startY + dy));
        if (d.kind === 'sticker') {
          setStickerPos({ x: nx, y: ny });
        } else if (d.kind === 'text' && d.id) {
          const dist = Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY);
          if (dist > 8) {
            d.textMovedBeyondThreshold = true;
          }
          if (!d.textMovedBeyondThreshold) return;
          setTexts((prev) =>
            prev.map((t) => (t.id === d.id ? { ...t, x: nx, y: ny } : t)),
          );
        }
      };
      const onUp = () => {
        const d = dragRef.current;
        if (d?.kind === 'text' && d.id && !d.textMovedBeyondThreshold) {
          setSelectedId(d.id);
          setEditingTextId(d.id);
        }
        dragRef.current = null;
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      return () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
    }, []);

    const startTextDrag = (e: React.PointerEvent, block: TextBlock) => {
      if (editingTextId === block.id) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedId(block.id);
      setEditingTextId(null);
      dragRef.current = {
        kind: 'text',
        id: block.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: block.x,
        startY: block.y,
        textMovedBeyondThreshold: false,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const startStickerDrag = (e: React.PointerEvent) => {
      if (!stickerSrc) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        kind: 'sticker',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: stickerPos.x,
        startY: stickerPos.y,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const startStageResize = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        kind: 'stage',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: 0,
        startY: 0,
        startW: stageW,
        startH: stageH,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const startFontResize = (e: React.PointerEvent, block: TextBlock) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        kind: 'fontSize',
        id: block.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: 0,
        startY: 0,
        startFontSize: block.fontSize,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const onTextDoubleClick = (e: React.MouseEvent, block: TextBlock) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedId(block.id);
      setEditingTextId(block.id);
    };

    const finishTextEdit = (id: string, el: HTMLElement) => {
      const next = el.innerText.replace(/\r/g, '').slice(0, MAX_TEXT_LEN);
      setTexts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, text: next || 'テキスト' } : t)),
      );
      setEditingTextId(null);
    };

    const addTextBlock = () => {
      if (texts.length >= MAX_TEXT_BLOCKS) {
        onToast({ message: `テキストは最大${MAX_TEXT_BLOCKS}個までだよ`, type: 'error' });
        return;
      }
      const id = generateId();
      const block: TextBlock = {
        id,
        text: 'テキスト',
        x: 50,
        y: 45,
        fontSize: 20,
        color: '#1e293b',
        fontIndex: 0,
      };
      setTexts((prev) => [...prev, block]);
      setSelectedId(id);
      setEditingTextId(null);
    };

    const removeSelectedText = () => {
      if (!selectedId) return;
      setTexts((prev) => prev.filter((t) => t.id !== selectedId));
      setSelectedId(null);
      setEditingTextId(null);
    };

    const updateSelected = (patch: Partial<TextBlock>) => {
      if (!selectedId) return;
      setTexts((prev) =>
        prev.map((t) => (t.id === selectedId ? { ...t, ...patch } : t)),
      );
    };

    const onBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f?.type.startsWith('image/')) return;
      const url = URL.createObjectURL(f);
      setBgImage((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return url;
      });
      e.target.value = '';
    };

    const clearBgImage = () => {
      setBgImage((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };

    const onStickerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f?.type.startsWith('image/')) return;
      const url = URL.createObjectURL(f);
      setStickerSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return url;
      });
      e.target.value = '';
    };

    const removeSticker = () => {
      setStickerSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };

    const handleSubmit = async () => {
      const el = stageRef.current;
      if (!el || submitting) return;

      let textsSnapshot = texts;
      if (editingTextId) {
        const editEl = editingContentRef.current;
        if (editEl) {
          const next =
            editEl.innerText.replace(/\r/g, '').slice(0, MAX_TEXT_LEN) || 'テキスト';
          textsSnapshot = texts.map((t) =>
            t.id === editingTextId ? { ...t, text: next } : t,
          );
        }
      }

      setSubmitting(true);
      try {
        flushSync(() => {
          setTexts(textsSnapshot);
          setEditingTextId(null);
          setSelectedId(null);
        });

        const dataUrl = await toPng(el, {
          cacheBust: true,
          pixelRatio: Math.min(
            2.5,
            typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2,
          ),
          backgroundColor: bgTransparent ? 'transparent' : undefined,
        });

        const blob = await dataUrlToBlob(dataUrl);
        const hossiiId = generateId();

        let imageUrl: string | null = await uploadCanvasPostImage(
          spaceId,
          hossiiId,
          blob,
        );

        if (!imageUrl) {
          if (isSupabaseConfigured) {
            onToast({
              message: '画像のアップロードに失敗しました。もう一度試してね',
              type: 'error',
            });
            return;
          }
          imageUrl = dataUrl;
        }

        addHossii({
          postKind: 'canvas',
          imageUrl,
          message: joinTextBlocksForMessage(textsSnapshot),
          ...(position
            ? { positionX: position.x, positionY: position.y, isPositionFixed: true }
            : {}),
        });

        onToast({
          message: continuousPost ? '置いたよ！続けてどうぞ ⭐' : '置いたよ！',
          type: 'success',
        });

        setTexts([]);
        setSelectedId(null);
        setEditingTextId(null);
        setStickerSrc((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return null;
        });
        setBgImage((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return null;
        });
        setBgTransparent(false);
        setStageW(STAGE_DEFAULT_W);
        setStageH(STAGE_DEFAULT_H);

        if (panelMode) {
          if (!continuousPost) {
            setTimeout(() => onClose?.(), 700);
          }
        } else if (!continuousPost) {
          setTimeout(() => onGoToSpace(), 800);
        }
      } catch (err) {
        console.error(err);
        onToast({
          message: '画像の生成に失敗しました。写真や背景を変えて試してね',
          type: 'error',
        });
      } finally {
        setSubmitting(false);
      }
    };

    const stageBgStyle: React.CSSProperties = {
      backgroundColor: bgTransparent ? 'transparent' : bgColor,
      backgroundImage: bgImage ? `url(${bgImage})` : undefined,
    };

    const useBlurredFill = Boolean(bgImage && !bgTransparent);

    return (
      <div className={styles.wrap}>
        <div className={styles.stageWrap}>
          <div className={styles.stageFrame}>
            <div
              ref={stageRef}
              className={`${styles.stage} ${bgTransparent && !bgImage ? styles.stageTransparentBg : ''}`}
              style={{ width: stageW, height: stageH }}
              onPointerDown={() => {
                if (!editingTextId) setSelectedId(null);
              }}
            >
              {useBlurredFill ? (
                <div className={styles.stageBgStack} style={{ backgroundColor: bgColor }}>
                  <div
                    className={styles.stageBgBlur}
                    style={{ backgroundImage: `url(${bgImage})` }}
                  />
                  <div
                    className={styles.stageBgSharp}
                    style={{ backgroundImage: `url(${bgImage})` }}
                  />
                </div>
              ) : (
                <div className={styles.stageBg} style={stageBgStyle} />
              )}
              {texts.map((t) => {
                const isSel = selectedId === t.id;
                const isEditing = editingTextId === t.id;
                return (
                  <div
                    key={t.id}
                    className={styles.textBlockWrap}
                    style={{
                      left: `${t.x}%`,
                      top: `${t.y}%`,
                    }}
                  >
                    {isEditing ? (
                      <div
                        ref={editingTextId === t.id ? editingContentRef : undefined}
                        role="textbox"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        className={`${styles.textBlock} ${FONT_CLASSES[t.fontIndex] ?? FONT_CLASSES[0]} ${styles.textBlockEditing}`}
                        style={{
                          fontSize: t.fontSize,
                          color: t.color,
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onBlur={(e) => finishTextEdit(t.id, e.currentTarget)}
                      >
                        {t.text}
                      </div>
                    ) : (
                      <>
                        <div
                          role="button"
                          tabIndex={0}
                          className={`${styles.textBlock} ${FONT_CLASSES[t.fontIndex] ?? FONT_CLASSES[0]} ${
                            isSel ? styles.textBlockSelected : ''
                          }`}
                          style={{
                            fontSize: t.fontSize,
                            color: t.color,
                          }}
                          onPointerDown={(e) => startTextDrag(e, t)}
                          onDoubleClick={(e) => onTextDoubleClick(e, t)}
                        >
                          {t.text}
                        </div>
                        {isSel && (
                          <div
                            role="slider"
                            aria-label="文字サイズ"
                            className={styles.textFontResizeHandle}
                            onPointerDown={(e) => startFontResize(e, t)}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {stickerSrc && (
                <img
                  src={stickerSrc}
                  alt=""
                  className={styles.sticker}
                  style={{
                    left: `${stickerPos.x}%`,
                    top: `${stickerPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onPointerDown={startStickerDrag}
                  draggable={false}
                />
              )}
            </div>
            <div
              className={styles.stageResizeHandle}
              title="カードのサイズ"
              onPointerDown={startStageResize}
            />
          </div>
        </div>

        <div className={styles.toolPanel}>
          <div className={styles.toolSection}>
            <span className={styles.toolSectionLabel}>背景</span>
            <div className={styles.toolTiles}>
              <button
                type="button"
                className={`${styles.toolTile} ${bgTransparent ? styles.toolTileActive : ''}`}
                aria-pressed={bgTransparent}
                onClick={() => setBgTransparent((v) => !v)}
                title="オンにするとスペースの壁紙が透けます"
              >
                <span className={styles.toolTileEmoji} aria-hidden>
                  🪟
                </span>
                <span className={styles.toolTileText}>壁紙透過</span>
              </button>
              <label
                className={`${styles.toolTile} ${styles.toolTileColor} ${bgTransparent ? styles.toolTileMuted : ''}`}
                title={bgTransparent ? '透過中は背景色を使いません' : '背景の色'}
              >
                <span className={styles.toolTileEmoji} aria-hidden>
                  🎨
                </span>
                <span className={styles.toolTileText}>色</span>
                <input
                  type="color"
                  className={styles.toolTileColorInput}
                  value={bgColor}
                  disabled={bgTransparent}
                  onChange={(e) => setBgColor(e.target.value)}
                  aria-label="背景色"
                />
              </label>
              <button
                type="button"
                className={`${styles.toolTile} ${bgImage ? styles.toolTileActive : ''}`}
                onClick={() => bgInputRef.current?.click()}
                title="背景に写真を敷く"
              >
                <span className={styles.toolTileEmoji} aria-hidden>
                  🖼
                </span>
                <span className={styles.toolTileText}>写真</span>
              </button>
              {bgImage && (
                <button
                  type="button"
                  className={`${styles.toolTile} ${styles.toolTileDanger}`}
                  onClick={clearBgImage}
                  title="背景の写真を外す"
                >
                  <span className={styles.toolTileEmoji} aria-hidden>
                    ✕
                  </span>
                  <span className={styles.toolTileText}>写真を外す</span>
                </button>
              )}
            </div>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              className={styles.srOnlyInput}
              onChange={onBgFile}
              aria-hidden={true}
              tabIndex={-1}
            />
          </div>

          <div className={styles.toolSection}>
            <span className={styles.toolSectionLabel}>テキスト</span>
            <button type="button" className={styles.toolTileWide} onClick={addTextBlock}>
              <span className={styles.toolTileEmoji} aria-hidden>
                ✏️
              </span>
              <span className={styles.toolTileText}>テキストを追加</span>
            </button>
            {selected && !editingTextId && (
              <div className={styles.textToolsRow}>
                <button type="button" className={styles.btn} onClick={removeSelectedText}>
                  削除
                </button>
                <input
                  type="text"
                  className={styles.altField}
                  value={selected.text}
                  maxLength={MAX_TEXT_LEN}
                  onChange={(e) =>
                    updateSelected({ text: e.target.value.slice(0, MAX_TEXT_LEN) })
                  }
                  placeholder="文言"
                  aria-label="選択中テキストの内容"
                />
                <div className={styles.sizeRow}>
                  <label>
                    大きさ{' '}
                    <input
                      type="range"
                      min={12}
                      max={36}
                      value={selected.fontSize}
                      onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={selected.color}
                  onChange={(e) => updateSelected({ color: e.target.value })}
                  aria-label="文字色"
                />
                <select
                  className={styles.fontSelect}
                  value={selected.fontIndex}
                  onChange={(e) => updateSelected({ fontIndex: Number(e.target.value) })}
                  aria-label="フォント"
                >
                  <option value={0}>ゴシック</option>
                  <option value={1}>丸ゴシック</option>
                  <option value={2}>丸ゴシック（代替）</option>
                  <option value={3}>等幅</option>
                  <option value={4}>明朝系</option>
                </select>
              </div>
            )}
          </div>

          <div className={styles.toolSection}>
            <span className={styles.toolSectionLabel}>重ねる画像</span>
            <div className={styles.toolTiles}>
              <button
                type="button"
                className={`${styles.toolTile} ${stickerSrc ? styles.toolTileActive : ''}`}
                onClick={() => stickerInputRef.current?.click()}
                title="カードの上に重ねる画像（1枚まで）"
              >
                <span className={styles.toolTileEmoji} aria-hidden>
                  📎
                </span>
                <span className={styles.toolTileText}>画像を選ぶ</span>
              </button>
              {stickerSrc && (
                <button
                  type="button"
                  className={`${styles.toolTile} ${styles.toolTileDanger}`}
                  onClick={removeSticker}
                  title="重ねた画像を外す"
                >
                  <span className={styles.toolTileEmoji} aria-hidden>
                    ✕
                  </span>
                  <span className={styles.toolTileText}>画像を外す</span>
                </button>
              )}
            </div>
            <input
              ref={stickerInputRef}
              type="file"
              accept="image/*"
              className={styles.srOnlyInput}
              onChange={onStickerFile}
              aria-hidden={true}
              tabIndex={-1}
            />
          </div>
        </div>

        <button
          type="button"
          className={styles.btnPrimary}
          disabled={submitting}
          onClick={() => void handleSubmit()}
          aria-label={submitting ? '送信中' : '気持ちを置く'}
        >
          {submitting ? '送信中...' : '気持ちを置く'}
        </button>
      </div>
    );
  },
);
