import { useState, useLayoutEffect, useCallback } from 'react';
import { computeSharpContentRect, type SharpContentRect } from '../utils/sharpContentRect';

const EMPTY_SHARP_RECT: SharpContentRect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * bubbleArea のサイズを監視し、contain 矩形を返す。
 * callback ref で要素接続を確実に検知する。
 */
export function useSharpContentRect() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [sharpRect, setSharpRect] = useState<SharpContentRect>(EMPTY_SHARP_RECT);

  const observeRef = useCallback((node: HTMLElement | null) => {
    setElement(node);
    if (node === null) {
      setContainerW(0);
      setContainerH(0);
      setSharpRect(EMPTY_SHARP_RECT);
    }
  }, []);

  useLayoutEffect(() => {
    if (!element) return;

    const update = () => {
      const w = element.clientWidth;
      const h = element.clientHeight;
      setContainerW(w);
      setContainerH(h);
      setSharpRect(computeSharpContentRect(w, h));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(element);
    return () => ro.disconnect();
  }, [element]);

  return { containerW, containerH, sharpRect, observeRef };
}
