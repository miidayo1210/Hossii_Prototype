import type { AxisRect } from '../../core/utils/connectionEdgePoint';
import type { BubbleAnchorHints } from '../../core/utils/connectionAnchorPadding';

/** 吹き出しレイアウト v2 の min-width 120px に合わせた compose 中の仮ターゲット */
export const TYPE_B_PROVISIONAL_BUBBLE_WIDTH_PX = 120;
export const TYPE_B_PROVISIONAL_BUBBLE_HEIGHT_PX = 72;

export function buildTypeBProvisionalTargetRect(
  center: { x: number; y: number },
): AxisRect {
  return {
    left: center.x - TYPE_B_PROVISIONAL_BUBBLE_WIDTH_PX / 2,
    top: center.y - TYPE_B_PROVISIONAL_BUBBLE_HEIGHT_PX / 2,
    width: TYPE_B_PROVISIONAL_BUBBLE_WIDTH_PX,
    height: TYPE_B_PROVISIONAL_BUBBLE_HEIGHT_PX,
  };
}

export function readBubbleHintsFromElement(el: HTMLElement): BubbleAnchorHints {
  return {
    hasLikeBadge: el.querySelector('[data-like-badge]') != null,
    hasOwnerBar: el.querySelector('[data-owner-actions]') != null,
  };
}
