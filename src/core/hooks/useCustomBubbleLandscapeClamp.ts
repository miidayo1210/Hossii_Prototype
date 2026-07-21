import { useLayoutEffect, useState, type RefObject } from 'react';
import { useMediaQuery } from './useMediaQuery';
import {
  MOBILE_LANDSCAPE_BUBBLE_MQ,
  domRectToAxisRect,
  measureBubbleClampOffset,
  parseClampPx,
} from '../utils/customBubbleLandscapePlacement';

function readCurrentClamp(el: HTMLElement): { x: number; y: number } {
  const style = getComputedStyle(el);
  return {
    x:
      parseClampPx(style.getPropertyValue('--bubble-clamp-x')) ||
      parseClampPx(style.getPropertyValue('--cluster-clamp-x')),
    y:
      parseClampPx(style.getPropertyValue('--bubble-clamp-y')) ||
      parseClampPx(style.getPropertyValue('--cluster-clamp-y')),
  };
}

/**
 * カスタムモード吹き出しを SP 横向きの bubbleArea 内に収める translate オフセット。
 * 星モード（StarView）には使わない。
 */
export function useCustomBubbleLandscapeClamp(
  containerRef: RefObject<HTMLElement | null>,
  remeasureKeys: readonly unknown[],
): { offset: { x: number; y: number }; isLandscape: boolean } {
  const isLandscape = useMediaQuery(MOBILE_LANDSCAPE_BUBBLE_MQ);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!isLandscape) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    const el = containerRef.current;
    const area = el?.closest('[data-bubble-area]') as HTMLElement | null;
    if (!el || !area) return;

    const measure = () => {
      const next = measureBubbleClampOffset(
        domRectToAxisRect(el.getBoundingClientRect()),
        domRectToAxisRect(area.getBoundingClientRect()),
        readCurrentClamp(el),
      );
      setOffset((prev) =>
        prev.x === next.x && prev.y === next.y ? prev : next,
      );
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(area);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasureKeys drives re-measure
  }, [isLandscape, containerRef, ...remeasureKeys]);

  return { offset, isLandscape };
}
