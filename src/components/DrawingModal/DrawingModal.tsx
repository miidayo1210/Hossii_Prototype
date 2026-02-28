import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './DrawingModal.module.css';

type Tool = 'pen' | 'eraser';

type HistoryEntry = ImageData;

const PEN_COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
const STROKE_SIZES = [2, 5, 12] as const;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

type Props = {
  onComplete: (file: File) => void;
  onClose: () => void;
};

export const DrawingModal = ({ onComplete, onClose }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [strokeSize, setStrokeSize] = useState<typeof STROKE_SIZES[number]>(5);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // drawing state refs（stale closure 回避）
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const toolRef = useRef<Tool>('pen');
  const penColorRef = useRef(PEN_COLORS[0]);
  const strokeSizeRef = useRef<number>(5);

  toolRef.current = tool;
  penColorRef.current = penColor;
  strokeSizeRef.current = strokeSize;

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-19), imageData]);
  }, []);

  const getCanvasPos = (e: PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // キャンバスの初期化（白背景）
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // pointer イベントの登録
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      saveHistory();
      isDrawingRef.current = true;
      setIsDrawing(true);
      lastPosRef.current = getCanvasPos(e);

      const ctx = getCtx();
      if (!ctx) return;
      const pos = lastPosRef.current;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, strokeSizeRef.current / 2, 0, Math.PI * 2);
      ctx.fillStyle = toolRef.current === 'eraser' ? '#ffffff' : penColorRef.current;
      ctx.fill();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const ctx = getCtx();
      if (!ctx || !lastPosRef.current) return;

      const pos = getCanvasPos(e);
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.lineWidth = strokeSizeRef.current;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = toolRef.current === 'eraser' ? '#ffffff' : penColorRef.current;
      ctx.stroke();
      lastPosRef.current = pos;
    };

    const onPointerUp = () => {
      isDrawingRef.current = false;
      setIsDrawing(false);
      lastPosRef.current = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [saveHistory]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const ctx = getCtx();
    if (!ctx) return;
    const prev = history[history.length - 1];
    ctx.putImageData(prev, 0, 0);
    setHistory((h) => h.slice(0, -1));
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    saveHistory();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });
      onComplete(file);
    }, 'image/png');
  };

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>✏️ お絵描き</span>
          <button type="button" className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        {/* ツールバー */}
        <div className={styles.toolbar}>
          {/* ツール選択 */}
          <div className={styles.toolGroup}>
            <button
              type="button"
              className={`${styles.toolButton} ${tool === 'pen' ? styles.toolButtonActive : ''}`}
              onClick={() => setTool('pen')}
              title="ペン"
            >
              ✏️
            </button>
            <button
              type="button"
              className={`${styles.toolButton} ${tool === 'eraser' ? styles.toolButtonActive : ''}`}
              onClick={() => setTool('eraser')}
              title="消しゴム"
            >
              🧹
            </button>
          </div>

          {/* ペン色 */}
          <div className={styles.toolGroup}>
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`${styles.colorSwatch} ${penColor === color && tool === 'pen' ? styles.colorSwatchActive : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => { setPenColor(color); setTool('pen'); }}
                title={color}
              />
            ))}
          </div>

          {/* 太さ */}
          <div className={styles.toolGroup}>
            {STROKE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={`${styles.sizeButton} ${strokeSize === size ? styles.sizeButtonActive : ''}`}
                onClick={() => setStrokeSize(size)}
                title={`太さ ${size}`}
              >
                <span className={styles.sizeDot} style={{ width: `${size * 1.8}px`, height: `${size * 1.8}px` }} />
              </button>
            ))}
          </div>

          {/* Undo / クリア */}
          <div className={styles.toolGroup}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleUndo}
              disabled={history.length === 0}
              title="元に戻す"
            >
              ↩
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleClear}
              title="クリア"
            >
              🗑
            </button>
          </div>
        </div>

        {/* キャンバス */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`${styles.canvas} ${isDrawing ? styles.canvasDrawing : ''}`}
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        />

        {/* 送信ボタン */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className={styles.sendButton} onClick={handleSend}>
            この絵を投稿する
          </button>
        </div>
      </div>
    </div>
  );
};
