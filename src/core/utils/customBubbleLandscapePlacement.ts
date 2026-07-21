/** カスタムモード吹き出し: SP 横向き（星モード PR #30 とは別 MQ） */
export const MOBILE_LANDSCAPE_BUBBLE_MQ =
  '(max-height: 600px) and (orientation: landscape)';

export const BUBBLE_VIEWPORT_MARGIN_PX = 8;

/** SP 横向き clamp 時の hover/active scale（SpaceScreen.module.css と一致） */
export const LANDSCAPE_BUBBLE_HOVER_SCALE = 1.05;

export type MeasureBubbleClampOptions = {
  marginPx?: number;
  /** hover scale 込みの bounding box で clamp（既定: 1 = scale 無視） */
  visualScale?: number;
};

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

  return snapClampOffset(dx, dy);
}

/** subpixel 丸めで 1px 未満のはみ出しを防ぐ（内側方向へ寄せる） */
export function snapClampOffset(x: number, y: number): { x: number; y: number } {
  return {
    x: x === 0 ? 0 : x < 0 ? Math.floor(x) : Math.ceil(x),
    y: y === 0 ? 0 : y < 0 ? Math.floor(y) : Math.ceil(y),
  };
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

/** 中心基準で矩形を拡大（CSS transform: scale の近似 bounding box） */
export function inflateRectForScale(rect: AxisRect, scale: number): AxisRect {
  if (scale <= 1) return rect;
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  const halfW = ((rect.right - rect.left) / 2) * scale;
  const halfH = ((rect.bottom - rect.top) / 2) * scale;
  return {
    left: cx - halfW,
    top: cy - halfH,
    right: cx + halfW,
    bottom: cy + halfH,
  };
}

export function measureBubbleClampOffset(
  bubbleRect: AxisRect,
  areaRect: AxisRect,
  currentClamp: { x: number; y: number },
  options: MeasureBubbleClampOptions | number = {},
): { x: number; y: number } {
  const opts: MeasureBubbleClampOptions =
    typeof options === 'number' ? { marginPx: options } : options;
  const marginPx = opts.marginPx ?? BUBBLE_VIEWPORT_MARGIN_PX;
  const visualScale = opts.visualScale ?? 1;

  const naturalRect = rectWithoutTranslate(
    bubbleRect,
    currentClamp.x,
    currentClamp.y,
  );
  const clampTarget =
    visualScale > 1
      ? inflateRectForScale(naturalRect, visualScale)
      : naturalRect;

  let offset = computeBubbleViewportClampOffset(
    clampTarget,
    areaRect,
    marginPx,
  );

  // translate 適用後に scale されるため、clamp 後の hover bounding box で 1 回だけ検証
  const clampedNatural = bubbleRectAfterClamp(naturalRect, offset);
  const verifyRect =
    visualScale > 1
      ? inflateRectForScale(clampedNatural, visualScale)
      : clampedNatural;
  if (!isRectInsideArea(verifyRect, areaRect, marginPx)) {
    const fix = computeBubbleViewportClampOffset(
      verifyRect,
      areaRect,
      marginPx,
    );
    offset = snapClampOffset(offset.x + fix.x, offset.y + fix.y);
  }

  return offset;
}

/** clamp 適用後の表示矩形（テスト・検証用） */
export function bubbleRectAfterClamp(
  naturalRect: AxisRect,
  offset: { x: number; y: number },
): AxisRect {
  return {
    left: naturalRect.left + offset.x,
    top: naturalRect.top + offset.y,
    right: naturalRect.right + offset.x,
    bottom: naturalRect.bottom + offset.y,
  };
}

export function isRectInsideArea(
  rect: AxisRect,
  areaRect: AxisRect,
  marginPx: number,
): boolean {
  return (
    rect.left >= areaRect.left + marginPx - 0.01 &&
    rect.top >= areaRect.top + marginPx - 0.01 &&
    rect.right <= areaRect.right - marginPx + 0.01 &&
    rect.bottom <= areaRect.bottom - marginPx + 0.01
  );
}
