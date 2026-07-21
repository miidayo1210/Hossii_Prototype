/** カスタムモード吹き出し: SP 横向き（星モード PR #30 とは別 MQ） */
export const MOBILE_LANDSCAPE_BUBBLE_MQ =
  '(max-height: 600px) and (orientation: landscape)';

export const BUBBLE_VIEWPORT_MARGIN_PX = 8;

export type AxisRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * 吹き出し矩形を bubbleArea（表示領域）内に収める translate オフセット（px）を返す。
 * viewport / 親要素の getBoundingClientRect を渡す。
 */
export function computeBubbleViewportClampOffset(
  bubbleRect: AxisRect,
  areaRect: AxisRect,
  marginPx = BUBBLE_VIEWPORT_MARGIN_PX,
): { x: number; y: number } {
  const minLeft = areaRect.left + marginPx;
  const maxRight = areaRect.right - marginPx;
  const minTop = areaRect.top + marginPx;
  const maxBottom = areaRect.bottom - marginPx;

  let dx = 0;
  let dy = 0;

  if (bubbleRect.right > maxRight) {
    dx += maxRight - bubbleRect.right;
  }
  if (bubbleRect.left + dx < minLeft) {
    dx = minLeft - bubbleRect.left;
  }

  if (bubbleRect.bottom > maxBottom) {
    dy += maxBottom - bubbleRect.bottom;
  }
  if (bubbleRect.top + dy < minTop) {
    dy = minTop - bubbleRect.top;
  }

  return { x: dx, y: dy };
}

export function domRectToAxisRect(rect: DOMRect): AxisRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

export function parseClampPx(value: string): number {
  const n = parseFloat(value.trim());
  return Number.isFinite(n) ? n : 0;
}

/** getBoundingClientRect は translate を含むため、clamp 適用前の自然位置へ戻す */
export function rectWithoutTranslate(
  rect: AxisRect,
  translateX: number,
  translateY: number,
): AxisRect {
  return {
    left: rect.left - translateX,
    top: rect.top - translateY,
    right: rect.right - translateX,
    bottom: rect.bottom - translateY,
  };
}

export function measureBubbleClampOffset(
  bubbleRect: AxisRect,
  areaRect: AxisRect,
  currentClamp: { x: number; y: number },
  marginPx = BUBBLE_VIEWPORT_MARGIN_PX,
): { x: number; y: number } {
  const naturalRect = rectWithoutTranslate(
    bubbleRect,
    currentClamp.x,
    currentClamp.y,
  );
  return computeBubbleViewportClampOffset(naturalRect, areaRect, marginPx);
}
