import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  loadFloatingRect,
  saveFloatingRect,
  clampFloatingRect,
  getFloatingPanelBottomInsetPx,
  type FloatingRect,
} from '../../core/utils/floatingPanelStorage';
import {
  FloatingPanelDragContext,
  type FloatingPanelDragHandleProps,
} from './floatingPanelDragContext';
import { shouldStartPanelDrag } from './floatingPanelHitTest';
import styles from './FloatingPanelShell.module.css';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type Props = {
  storageKey: string;
  defaultRect: FloatingRect;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  zIndex?: number;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

function applyResize(
  dir: ResizeDir,
  start: FloatingRect,
  dx: number,
  dy: number,
  vw: number,
  vh: number,
  minW: number,
  minH: number,
  maxW: number | undefined,
  maxH: number | undefined,
  bottomInset: number
): FloatingRect {
  let { x, y, w, h } = start;
  switch (dir) {
    case 'e':
      w = start.w + dx;
      break;
    case 'w':
      x = start.x + dx;
      w = start.w - dx;
      break;
    case 's':
      h = start.h + dy;
      break;
    case 'n':
      y = start.y + dy;
      h = start.h - dy;
      break;
    case 'se':
      w = start.w + dx;
      h = start.h + dy;
      break;
    case 'sw':
      x = start.x + dx;
      w = start.w - dx;
      h = start.h + dy;
      break;
    case 'ne':
      y = start.y + dy;
      w = start.w + dx;
      h = start.h - dy;
      break;
    case 'nw':
      x = start.x + dx;
      y = start.y + dy;
      w = start.w - dx;
      h = start.h - dy;
      break;
    default:
      break;
  }
  return clampFloatingRect({ x, y, w, h }, vw, vh, minW, minH, maxW, maxH, bottomInset);
}

export function FloatingPanelShell({
  storageKey,
  defaultRect,
  minW = 200,
  minH = 120,
  maxW,
  maxH,
  zIndex = 200,
  className = '',
  contentClassName = '',
  children,
}: Props) {
  const [rect, setRect] = useState<FloatingRect>(() => {
    if (typeof window === 'undefined') return defaultRect;
    const loaded = loadFloatingRect(storageKey, defaultRect);
    const inset = getFloatingPanelBottomInsetPx();
    return clampFloatingRect(loaded, window.innerWidth, window.innerHeight, minW, minH, maxW, maxH, inset);
  });

  const rectRef = useRef(rect);

  useLayoutEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const inset = getFloatingPanelBottomInsetPx();
      setRect((prev) => clampFloatingRect(prev, w, h, minW, minH, maxW, maxH, inset));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [minW, minH, maxW, maxH]);

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    return () => {
      document.body.style.cursor = prev;
    };
  }, [isDragging]);

  const dragRef = useRef({ startClientX: 0, startClientY: 0, startX: 0, startY: 0 });

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      const r = rectRef.current;
      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: r.x,
        startY: r.y,
      };

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - dragRef.current.startClientX;
        const dy = ev.clientY - dragRef.current.startClientY;
        const next: FloatingRect = {
          ...rectRef.current,
          x: dragRef.current.startX + dx,
          y: dragRef.current.startY + dy,
        };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const inset = getFloatingPanelBottomInsetPx();
        const c = clampFloatingRect(next, vw, vh, minW, minH, maxW, maxH, inset);
        rectRef.current = c;
        setRect(c);
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        setIsDragging(false);
        saveFloatingRect(storageKey, rectRef.current);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [storageKey, minW, minH, maxW, maxH]
  );

  const onShellPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (!shouldStartPanelDrag(e.target)) return;
      onDragPointerDown(e);
    },
    [onDragPointerDown]
  );

  const resizeStartRef = useRef<{ dir: ResizeDir; rect: FloatingRect; cx: number; cy: number }>({
    dir: 'se',
    rect: rect,
    cx: 0,
    cy: 0,
  });

  const onResizePointerDown = useCallback(
    (dir: ResizeDir) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      resizeStartRef.current = {
        dir,
        rect: { ...rectRef.current },
        cx: e.clientX,
        cy: e.clientY,
      };

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - resizeStartRef.current.cx;
        const dy = ev.clientY - resizeStartRef.current.cy;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const inset = getFloatingPanelBottomInsetPx();
        const c = applyResize(
          resizeStartRef.current.dir,
          resizeStartRef.current.rect,
          dx,
          dy,
          vw,
          vh,
          minW,
          minH,
          maxW,
          maxH,
          inset
        );
        rectRef.current = c;
        setRect(c);
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        saveFloatingRect(storageKey, rectRef.current);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [storageKey, minW, minH, maxW, maxH]
  );

  const dragHandleProps: FloatingPanelDragHandleProps = {
    onPointerDown: onShellPointerDown,
    style: { touchAction: 'none' as const },
  };

  const resizeLabels: Record<ResizeDir, string> = {
    n: '上端で高さを変更',
    s: '下端で高さを変更',
    e: '右端で幅を変更',
    w: '左端で幅を変更',
    ne: '右上の角でサイズを変更',
    nw: '左上の角でサイズを変更',
    se: '右下の角でサイズを変更',
    sw: '左下の角でサイズを変更',
  };

  return (
    <>
      <FloatingPanelDragContext.Provider value={dragHandleProps}>
        <div
          className={`${styles.shell}${isDragging ? ` ${styles.shellDragging}` : ''} ${className}`}
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            zIndex,
          }}
          onPointerDown={onShellPointerDown}
        >
        <div className={`${styles.content} ${contentClassName}`}>{children}</div>

        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.n}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeN}`}
          onPointerDown={onResizePointerDown('n')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.s}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeS}`}
          onPointerDown={onResizePointerDown('s')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.e}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeE}`}
          onPointerDown={onResizePointerDown('e')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.w}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeW}`}
          onPointerDown={onResizePointerDown('w')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.ne}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeNE}`}
          onPointerDown={onResizePointerDown('ne')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.nw}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeNW}`}
          onPointerDown={onResizePointerDown('nw')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.se}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeSE}`}
          onPointerDown={onResizePointerDown('se')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={resizeLabels.sw}
          data-floating-resize
          className={`${styles.resizeHandle} ${styles.resizeSW}`}
          onPointerDown={onResizePointerDown('sw')}
        />
        </div>
      </FloatingPanelDragContext.Provider>
    </>
  );
}
