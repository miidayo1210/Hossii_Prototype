import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useMediaQuery } from './useMediaQuery';
import {
  LANDSCAPE_BUBBLE_HOVER_SCALE,
  MOBILE_LANDSCAPE_BUBBLE_MQ,
  domRectToAxisRect,
  measureBubbleClampOffset,
  parseClampPx,
} from '../utils/customBubbleLandscapePlacement';

function readAppliedTranslate(
  el: HTMLElement,
  /** transform / CSS var が読めないときのフォールバック（再計測ループ防止） */
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const style = getComputedStyle(el);
  const fromVars = {
    x:
      parseClampPx(style.getPropertyValue('--bubble-clamp-x')) ||
      parseClampPx(style.getPropertyValue('--cluster-clamp-x')),
    y:
      parseClampPx(style.getPropertyValue('--bubble-clamp-y')) ||
      parseClampPx(style.getPropertyValue('--cluster-clamp-y')),
  };

  const transform = style.transform;
  if (transform && transform !== 'none') {
    try {
      const matrix = new DOMMatrix(transform);
      return { x: matrix.m41, y: matrix.m42 };
    } catch {
      // fall through to CSS vars / fallback
    }
  }

  if (fromVars.x !== 0 || fromVars.y !== 0) return fromVars;
  return fallback;
}

/**
 * カスタムモード吹き出しを SP 横向きの bubbleArea 内に収める translate オフセット。
 * 星モード（StarView）には使わない。
 *
 * containerRef は吹き出し本体のみ（操作メニュー data-owner-actions は sibling のため対象外）。
 */
export function useCustomBubbleLandscapeClamp(
  containerRef: RefObject<HTMLElement | null>,
  remeasureKeys: readonly unknown[],
): { offset: { x: number; y: number }; isLandscape: boolean } {
  const isLandscape = useMediaQuery(MOBILE_LANDSCAPE_BUBBLE_MQ);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!isLandscape) {
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
      return;
    }

    const el = containerRef.current;
    const area = el?.closest('[data-bubble-area]') as HTMLElement | null;
    if (!el || !area) return;

    let disposed = false;

    const applyOffset = (next: { x: number; y: number }) => {
      offsetRef.current = next;
      setOffset((prev) =>
        prev.x === next.x && prev.y === next.y ? prev : next,
      );
    };

    const measureNow = () => {
      if (disposed) return;
      const next = measureBubbleClampOffset(
        domRectToAxisRect(el.getBoundingClientRect()),
        domRectToAxisRect(area.getBoundingClientRect()),
        readAppliedTranslate(el, offsetRef.current),
        { visualScale: LANDSCAPE_BUBBLE_HOVER_SCALE },
      );
      applyOffset(next);
    };

    /** RO / resize / image load を rAF にまとめ、ResizeObserver loop を避ける */
    const scheduleMeasure = () => {
      if (disposed || rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        measureNow();
      });
    };

    measureNow();
    scheduleMeasure();

    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(el);
    const contentEl = el.querySelector('[data-bubble-clamp-content]');
    if (contentEl instanceof HTMLElement) {
      ro.observe(contentEl);
    }
    ro.observe(area);

    const onImageLoad = () => scheduleMeasure();
    const bindImageLoads = () => {
      el.querySelectorAll('img').forEach((img) => {
        img.removeEventListener('load', onImageLoad);
        if (img.complete) {
          scheduleMeasure();
        } else {
          img.addEventListener('load', onImageLoad, { once: true });
        }
      });
    };
    bindImageLoads();

    window.addEventListener('resize', scheduleMeasure);

    return () => {
      disposed = true;
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      el.querySelectorAll('img').forEach((img) => {
        img.removeEventListener('load', onImageLoad);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasureKeys drives re-measure
  }, [isLandscape, containerRef, ...remeasureKeys]);

  return { offset, isLandscape };
}
