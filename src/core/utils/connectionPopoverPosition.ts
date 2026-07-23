export const CONNECTION_POPOVER_VIEWPORT_MARGIN = 8;
export const CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT = 320;
export const CONNECTION_POPOVER_STRENGTH_ESTIMATED_MAX_HEIGHT = 400;

export type ConnectionPopoverViewport = {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;
};

export type StrengthPopoverLayoutInput = {
  anchorRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>;
  popoverWidth: number;
  gap: number;
  estimatedHeight: number;
  viewport?: ConnectionPopoverViewport;
  margin?: number;
};

export type StrengthPopoverLayout = {
  top: number;
  left: number;
};

export function readConnectionPopoverViewport(
  windowObj: Window = window,
): ConnectionPopoverViewport {
  const visualViewport = windowObj.visualViewport;
  if (visualViewport) {
    return {
      height: visualViewport.height,
      width: visualViewport.width,
      offsetTop: visualViewport.offsetTop,
      offsetLeft: visualViewport.offsetLeft,
    };
  }

  return {
    height: windowObj.innerHeight,
    width: windowObj.innerWidth,
    offsetTop: 0,
    offsetLeft: 0,
  };
}

export function clampPopoverHorizontal(left: number, width: number): number {
  return clampPopoverHorizontalInViewport(left, width, readConnectionPopoverViewport());
}

export function clampPopoverHorizontalInViewport(
  left: number,
  width: number,
  viewport: ConnectionPopoverViewport,
  margin = CONNECTION_POPOVER_VIEWPORT_MARGIN,
): number {
  const visibleLeft = viewport.offsetLeft + margin;
  const visibleRight = viewport.offsetLeft + viewport.width - margin;
  return Math.max(visibleLeft, Math.min(left, visibleRight - width));
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

/** Strength editor: top-based layout clamped to the visible viewport (keyboard-aware). */
export function computeStrengthPopoverTopLeft({
  anchorRect,
  popoverWidth,
  gap,
  estimatedHeight,
  viewport = readConnectionPopoverViewport(),
  margin = CONNECTION_POPOVER_VIEWPORT_MARGIN,
}: StrengthPopoverLayoutInput): StrengthPopoverLayout {
  const visibleTop = viewport.offsetTop + margin;
  const visibleBottom = viewport.offsetTop + viewport.height - margin;
  const visibleHeight = visibleBottom - visibleTop;

  let top = anchorRect.top - gap - estimatedHeight;

  if (top + estimatedHeight > visibleBottom) {
    top = visibleBottom - estimatedHeight;
  }

  if (estimatedHeight <= visibleHeight) {
    top = Math.max(visibleTop, Math.min(top, visibleBottom - estimatedHeight));
  }

  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = clampPopoverHorizontalInViewport(
    centerX - popoverWidth / 2,
    popoverWidth,
    viewport,
    margin,
  );

  return { top, left };
}
