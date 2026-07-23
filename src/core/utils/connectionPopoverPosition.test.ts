import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  clampPopoverHorizontal,
  clampPopoverHorizontalInViewport,
  computePopoverBottomAboveAnchor,
  computeStrengthPopoverTopLeft,
  readConnectionPopoverViewport,
  CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT,
  CONNECTION_POPOVER_STRENGTH_ESTIMATED_MAX_HEIGHT,
  CONNECTION_POPOVER_VIEWPORT_MARGIN,
} from './connectionPopoverPosition';

function makeWindow(overrides: {
  innerWidth?: number;
  innerHeight?: number;
  visualViewport?: Partial<VisualViewport> | null;
}): Window {
  return {
    innerWidth: overrides.innerWidth ?? 844,
    innerHeight: overrides.innerHeight ?? 390,
    visualViewport: overrides.visualViewport ?? null,
  } as Window;
}

describe('readConnectionPopoverViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to window metrics when visualViewport is unavailable', () => {
    const windowObj = makeWindow({ innerWidth: 800, innerHeight: 600, visualViewport: null });
    expect(readConnectionPopoverViewport(windowObj)).toEqual({
      height: 600,
      width: 800,
      offsetTop: 0,
      offsetLeft: 0,
    });
  });

  it('uses visualViewport metrics when available', () => {
    const windowObj = makeWindow({
      innerHeight: 390,
      innerWidth: 844,
      visualViewport: {
        height: 140,
        width: 844,
        offsetTop: 20,
        offsetLeft: 0,
      },
    });

    expect(readConnectionPopoverViewport(windowObj)).toEqual({
      height: 140,
      width: 844,
      offsetTop: 20,
      offsetLeft: 0,
    });
  });
});

describe('clampPopoverHorizontal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps popover inside viewport horizontally', () => {
    vi.stubGlobal('window', makeWindow({ innerWidth: 400, innerHeight: 600 }));

    expect(clampPopoverHorizontal(0, 260)).toBe(CONNECTION_POPOVER_VIEWPORT_MARGIN);
    expect(clampPopoverHorizontal(200, 260)).toBe(132);
    expect(clampPopoverHorizontal(380, 260)).toBe(132);
  });
});

describe('computePopoverBottomAboveAnchor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('positions above anchor when there is room', () => {
    vi.stubGlobal('window', makeWindow({ innerHeight: 600 }));

    expect(computePopoverBottomAboveAnchor(500, 10, 80)).toBe(110);
  });

  it('clamps bottom when anchor is near the top on short viewports', () => {
    vi.stubGlobal('window', makeWindow({ innerHeight: 390 }));

    const bottom = computePopoverBottomAboveAnchor(20, 10, CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT);
    expect(bottom).toBeLessThan(390 - 20 + 10);
    expect(bottom).toBe(390 - CONNECTION_POPOVER_VIEWPORT_MARGIN - CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT);
  });
});

describe('computeStrengthPopoverTopLeft', () => {
  const anchorRect = {
    top: 250,
    bottom: 300,
    left: 400,
    width: 120,
  } as DOMRect;
  const popoverWidth = 220;

  it('matches above-anchor placement on PC-sized viewports without visualViewport', () => {
    const viewport = {
      height: 600,
      width: 844,
      offsetTop: 0,
      offsetLeft: 0,
    };
    const pcAnchor = { ...anchorRect, top: 400, bottom: 450 };
    const estimatedHeight = 280;
    const layout = computeStrengthPopoverTopLeft({
      anchorRect: pcAnchor,
      popoverWidth,
      gap: 10,
      estimatedHeight,
      viewport,
    });

    expect(layout.top).toBe(pcAnchor.top - 10 - estimatedHeight);
    expect(layout.top + estimatedHeight).toBeLessThanOrEqual(pcAnchor.top - 10);
  });

  it('bottom-aligns within a keyboard-shrunk visual viewport', () => {
    const viewport = {
      height: 140,
      width: 844,
      offsetTop: 0,
      offsetLeft: 0,
    };
    const estimatedHeight = CONNECTION_POPOVER_STRENGTH_ESTIMATED_MAX_HEIGHT;
    const layout = computeStrengthPopoverTopLeft({
      anchorRect,
      popoverWidth,
      gap: 10,
      estimatedHeight,
      viewport,
    });

    expect(layout.top + estimatedHeight).toBe(
      viewport.offsetTop + viewport.height - CONNECTION_POPOVER_VIEWPORT_MARGIN,
    );
  });

  it('respects visualViewport offsetTop', () => {
    const viewport = {
      height: 160,
      width: 844,
      offsetTop: 40,
      offsetLeft: 0,
    };
    const estimatedHeight = CONNECTION_POPOVER_STRENGTH_ESTIMATED_MAX_HEIGHT;
    const layout = computeStrengthPopoverTopLeft({
      anchorRect: { ...anchorRect, top: 120, bottom: 170 },
      popoverWidth,
      gap: 10,
      estimatedHeight,
      viewport,
    });

    expect(layout.top + estimatedHeight).toBeLessThanOrEqual(
      viewport.offsetTop + viewport.height - CONNECTION_POPOVER_VIEWPORT_MARGIN,
    );
    expect(layout.top).toBeGreaterThanOrEqual(
      viewport.offsetTop + CONNECTION_POPOVER_VIEWPORT_MARGIN - estimatedHeight,
    );
  });

  it('returns to above-anchor placement after keyboard dismiss restores viewport height', () => {
    const keyboardViewport = {
      height: 140,
      width: 844,
      offsetTop: 0,
      offsetLeft: 0,
    };
    const restoredViewport = {
      height: 390,
      width: 844,
      offsetTop: 0,
      offsetLeft: 0,
    };
    const estimatedHeight = CONNECTION_POPOVER_STRENGTH_ESTIMATED_MAX_HEIGHT;

    const keyboardLayout = computeStrengthPopoverTopLeft({
      anchorRect,
      popoverWidth,
      gap: 10,
      estimatedHeight,
      viewport: keyboardViewport,
    });
    const restoredLayout = computeStrengthPopoverTopLeft({
      anchorRect,
      popoverWidth,
      gap: 10,
      estimatedHeight,
      viewport: restoredViewport,
    });

    expect(keyboardLayout.top).toBeLessThan(restoredLayout.top);
    expect(restoredLayout.top).toBe(anchorRect.top - 10 - estimatedHeight);
  });

  it('clamps horizontally within visual viewport offsets', () => {
    const viewport = {
      height: 390,
      width: 300,
      offsetTop: 0,
      offsetLeft: 20,
    };
    const layout = computeStrengthPopoverTopLeft({
      anchorRect: { ...anchorRect, left: 10, width: 40 },
      popoverWidth,
      gap: 10,
      estimatedHeight: 280,
      viewport,
    });

    expect(layout.left).toBeGreaterThanOrEqual(viewport.offsetLeft + CONNECTION_POPOVER_VIEWPORT_MARGIN);
    expect(layout.left + popoverWidth).toBeLessThanOrEqual(
      viewport.offsetLeft + viewport.width - CONNECTION_POPOVER_VIEWPORT_MARGIN,
    );
    expect(
      clampPopoverHorizontalInViewport(0, popoverWidth, viewport),
    ).toBe(viewport.offsetLeft + CONNECTION_POPOVER_VIEWPORT_MARGIN);
  });
});
