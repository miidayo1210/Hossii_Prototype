export const CONNECTION_POPOVER_VIEWPORT_MARGIN = 8;
export const CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT = 320;
export const CONNECTION_POPOVER_STRENGTH_ESTIMATED_MAX_HEIGHT = 400;

export function clampPopoverHorizontal(left: number, width: number): number {
  return Math.max(
    CONNECTION_POPOVER_VIEWPORT_MARGIN,
    Math.min(left, window.innerWidth - width - CONNECTION_POPOVER_VIEWPORT_MARGIN),
  );
}

/** Positions popover above anchor using CSS `bottom`, clamped to stay inside viewport. */
export function computePopoverBottomAboveAnchor(
  anchorRectTop: number,
  gap: number,
  estimatedMaxHeight = CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT,
): number {
  const rawBottom = window.innerHeight - anchorRectTop + gap;
  const maxBottom = Math.max(
    gap,
    window.innerHeight - CONNECTION_POPOVER_VIEWPORT_MARGIN - estimatedMaxHeight,
  );
  return Math.min(rawBottom, maxBottom);
}
