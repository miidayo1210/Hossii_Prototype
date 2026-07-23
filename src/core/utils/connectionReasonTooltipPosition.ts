export const CONNECTION_REASON_TOOLTIP_POINTER_OFFSET = 12;
export const CONNECTION_REASON_TOOLTIP_VIEWPORT_MARGIN = 8;

export type ClampConnectionReasonTooltipPositionInput = {
  clientX: number;
  clientY: number;
  overlayRect: Pick<DOMRect, 'left' | 'top'>;
  tooltipWidth: number;
  tooltipHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pointerOffset?: number;
  viewportMargin?: number;
};

/** pointer 付近を起点に viewport 内へ収め、overlay ローカル座標で返す */
export function clampConnectionReasonTooltipPosition({
  clientX,
  clientY,
  overlayRect,
  tooltipWidth,
  tooltipHeight,
  viewportWidth,
  viewportHeight,
  pointerOffset = CONNECTION_REASON_TOOLTIP_POINTER_OFFSET,
  viewportMargin = CONNECTION_REASON_TOOLTIP_VIEWPORT_MARGIN,
}: ClampConnectionReasonTooltipPositionInput): { left: number; top: number } {
  let viewportLeft = clientX + pointerOffset;
  let viewportTop = clientY + pointerOffset;

  const minLeft = viewportMargin;
  const minTop = viewportMargin;
  const maxLeft = Math.max(minLeft, viewportWidth - tooltipWidth - viewportMargin);
  const maxTop = Math.max(minTop, viewportHeight - tooltipHeight - viewportMargin);

  viewportLeft = Math.min(Math.max(minLeft, viewportLeft), maxLeft);
  viewportTop = Math.min(Math.max(minTop, viewportTop), maxTop);

  return {
    left: viewportLeft - overlayRect.left,
    top: viewportTop - overlayRect.top,
  };
}
