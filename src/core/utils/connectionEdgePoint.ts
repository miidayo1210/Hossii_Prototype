import {
  insetRect,
  resolveConnectionEdgeInsets,
  type BubbleAnchorHints,
  type ConnectionEdgeInsets,
} from './connectionAnchorPadding';

export type Point2D = { x: number; y: number };

export type AxisRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function rectCenter(rect: AxisRect): Point2D {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * 矩形内の中心から target 方向へ伸ばした半直線が、
 * 矩形の辺（inset 済み）と交わる点を返す。
 */
export function getRectEdgePointTowardTarget(
  rect: AxisRect,
  target: Point2D,
  insets?: ConnectionEdgeInsets,
): Point2D {
  const effective = insets ? insetRect(rect, insets) : rect;
  const cx = effective.left + effective.width / 2;
  const cy = effective.top + effective.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return { x: cx, y: cy };
  }

  const candidates: number[] = [];
  if (dx > 0) candidates.push((effective.left + effective.width - cx) / dx);
  else if (dx < 0) candidates.push((effective.left - cx) / dx);

  if (dy > 0) candidates.push((effective.top + effective.height - cy) / dy);
  else if (dy < 0) candidates.push((effective.top - cy) / dy);

  const positive = candidates.filter((t) => t > 0);
  const t = positive.length > 0 ? Math.min(...positive) : 0;
  return { x: cx + dx * t, y: cy + dy * t };
}

export function getBubbleConnectionPoint(
  bubbleRect: AxisRect,
  bubbleHints: BubbleAnchorHints,
  otherCenter: Point2D,
): Point2D {
  const insets = resolveConnectionEdgeInsets(bubbleHints);
  return getRectEdgePointTowardTarget(bubbleRect, otherCenter, insets);
}

export function domRectToAxisRect(rect: DOMRect): AxisRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function toLocalPoint(point: Point2D, origin: DOMRect): Point2D {
  return {
    x: point.x - origin.left,
    y: point.y - origin.top,
  };
}
