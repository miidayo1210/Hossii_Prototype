import { describe, expect, it } from 'vitest';
import {
  BUBBLE_VIEWPORT_MARGIN_PX,
  bubbleRectAfterClamp,
  computeBubbleViewportClampOffset,
  isRectInsideArea,
  measureBubbleClampOffset,
  rectWithoutTranslate,
  snapClampOffset,
  type AxisRect,
} from './customBubbleLandscapePlacement';

/** Production 844×390 landscape bubbleArea（小数 px） */
const PRODUCTION_AREA: AxisRect = {
  left: 0,
  top: 112,
  right: 844,
  bottom: 502,
};

describe('computeBubbleViewportClampOffset', () => {
  const area = { left: 0, top: 0, right: 844, bottom: 390 };

  it('returns zero when bubble is fully inside', () => {
    const bubble = { left: 100, top: 80, right: 300, bottom: 200 };
    expect(computeBubbleViewportClampOffset(bubble, area)).toEqual({ x: 0, y: 0 });
  });

  it('shifts left when overflowing right edge', () => {
    const bubble = { left: 700, top: 80, right: 960, bottom: 200 };
    const { x, y } = computeBubbleViewportClampOffset(bubble, area);
    expect(y).toBe(0);
    expect(bubble.right + x).toBeLessThanOrEqual(
      area.right - BUBBLE_VIEWPORT_MARGIN_PX + 0.01,
    );
    expect(x).toBeLessThan(0);
  });

  it('shifts right when overflowing left edge', () => {
    const bubble = { left: 1, top: 80, right: 180, bottom: 200 };
    const { x } = computeBubbleViewportClampOffset(bubble, area);
    expect(bubble.left + x).toBeGreaterThanOrEqual(
      area.left + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
    expect(x).toBeGreaterThan(0);
  });

  it('shifts up when overflowing bottom edge', () => {
    const bubble = { left: 100, top: 300, right: 320, bottom: 420 };
    const { y } = computeBubbleViewportClampOffset(bubble, area);
    expect(bubble.bottom + y).toBeLessThanOrEqual(
      area.bottom - BUBBLE_VIEWPORT_MARGIN_PX + 0.01,
    );
    expect(y).toBeLessThan(0);
  });

  it('shifts down when overflowing top edge', () => {
    const bubble = { left: 100, top: 1, right: 320, bottom: 120 };
    const { y } = computeBubbleViewportClampOffset(bubble, area);
    expect(bubble.top + y).toBeGreaterThanOrEqual(
      area.top + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
    expect(y).toBeGreaterThan(0);
  });

  it('handles bottom-right corner overflow on both axes', () => {
    const bubble = { left: 720, top: 320, right: 980, bottom: 450 };
    const offset = computeBubbleViewportClampOffset(bubble, area);
    expect(bubble.right + offset.x).toBeLessThanOrEqual(
      area.right - BUBBLE_VIEWPORT_MARGIN_PX + 0.01,
    );
    expect(bubble.bottom + offset.y).toBeLessThanOrEqual(
      area.bottom - BUBBLE_VIEWPORT_MARGIN_PX + 0.01,
    );
  });

  it('clamps oversized bubble to margins without NaN', () => {
    const bubble = { left: 50, top: 40, right: 900, bottom: 500 };
    const offset = computeBubbleViewportClampOffset(bubble, area);
    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
    expect(bubble.left + offset.x).toBeGreaterThanOrEqual(
      area.left + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
    expect(bubble.top + offset.y).toBeGreaterThanOrEqual(
      area.top + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
  });

  it('respects custom margin padding', () => {
    const bubble = { left: 700, top: 80, right: 960, bottom: 200 };
    const margin = 16;
    const offset = computeBubbleViewportClampOffset(bubble, area, margin);
    expect(bubble.right + offset.x).toBeLessThanOrEqual(area.right - margin + 0.01);
  });
});

describe('snapClampOffset', () => {
  it('floors negative offsets inward', () => {
    expect(snapClampOffset(-17.04, -21.39)).toEqual({ x: -18, y: -22 });
  });

  it('ceilings positive offsets inward', () => {
    expect(snapClampOffset(8.2, 0.1)).toEqual({ x: 9, y: 1 });
  });
});

describe('rectWithoutTranslate', () => {
  it('removes applied translate from measured rect', () => {
    const rect = { left: 720, top: 410, right: 836, bottom: 494 };
    expect(rectWithoutTranslate(rect, -80, -60)).toEqual({
      left: 800,
      top: 470,
      right: 916,
      bottom: 554,
    });
  });
});

describe('measureBubbleClampOffset', () => {
  const area = { left: 0, top: 112, right: 844, bottom: 502 };

  it('returns zero when clamp is not needed', () => {
    const bubble = { left: 100, top: 200, right: 260, bottom: 290 };
    expect(measureBubbleClampOffset(bubble, area, { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('computes both axes even when prior clamp hides one-axis overflow', () => {
    const measuredWithStaleY = { left: 722, top: 412, right: 836, bottom: 494 };
    const offset = measureBubbleClampOffset(measuredWithStaleY, area, {
      x: -80,
      y: -59,
    });
    expect(offset.x).toBeLessThan(0);
    expect(offset.y).toBeLessThan(0);
    const natural = rectWithoutTranslate(measuredWithStaleY, -80, -59);
    expect(natural.bottom).toBeGreaterThan(area.bottom - BUBBLE_VIEWPORT_MARGIN_PX);
    expect(natural.right).toBeGreaterThan(area.right - BUBBLE_VIEWPORT_MARGIN_PX);
  });

  it('handles bubble larger than viewport on both axes', () => {
    const bubble = { left: 720, top: 400, right: 900, bottom: 560 };
    const offset = measureBubbleClampOffset(bubble, area, { x: 0, y: 0 });
    expect(bubble.left + offset.x).toBeGreaterThanOrEqual(
      area.left + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
    expect(bubble.top + offset.y).toBeGreaterThanOrEqual(
      area.top + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
  });
});

describe('fractional / DPR-like rects', () => {
  it('handles subpixel container and bubble rects from production', () => {
    const area = {
      left: 0,
      top: 112.5,
      right: 843.6875,
      bottom: 501.984375,
    };
    const bubble = {
      left: 798.7581481933594,
      top: 329.605224609375,
      right: 869.7268981933594,
      bottom: 450.902099609375,
    };
    const offset = computeBubbleViewportClampOffset(bubble, area);
    expect(
      isRectInsideArea(bubbleRectAfterClamp(bubble, offset), area, 8),
    ).toBe(true);
  });

  it('handles hover-scale enlarged rect (5% larger, centered expansion approx)', () => {
    const bubble = { left: 700, top: 300, right: 900, bottom: 420 };
    const scale = 1.05;
    const cx = (bubble.left + bubble.right) / 2;
    const cy = (bubble.top + bubble.bottom) / 2;
    const halfW = ((bubble.right - bubble.left) / 2) * scale;
    const halfH = ((bubble.bottom - bubble.top) / 2) * scale;
    const scaled = {
      left: cx - halfW,
      top: cy - halfH,
      right: cx + halfW,
      bottom: cy + halfH,
    };
    const offset = computeBubbleViewportClampOffset(scaled, PRODUCTION_AREA);
    expect(
      isRectInsideArea(bubbleRectAfterClamp(scaled, offset), PRODUCTION_AREA, 8),
    ).toBe(true);
  });
});

describe('safe margin 4px vs 8px', () => {
  const bubble = { left: 790, top: 320, right: 852.6875, bottom: 441.5 };

  it('respects 8px default margin', () => {
    const offset = computeBubbleViewportClampOffset(bubble, PRODUCTION_AREA, 8);
    expect(
      isRectInsideArea(bubbleRectAfterClamp(bubble, offset), PRODUCTION_AREA, 8),
    ).toBe(true);
  });

  it('respects 4px verification margin', () => {
    const offset = computeBubbleViewportClampOffset(bubble, PRODUCTION_AREA, 4);
    expect(
      isRectInsideArea(bubbleRectAfterClamp(bubble, offset), PRODUCTION_AREA, 4),
    ).toBe(true);
  });

  it('8px margin is stricter than 4px margin', () => {
    const o4 = computeBubbleViewportClampOffset(bubble, PRODUCTION_AREA, 4);
    const o8 = computeBubbleViewportClampOffset(bubble, PRODUCTION_AREA, 8);
    expect(o8.x).toBeLessThanOrEqual(o4.x);
  });
});

describe('right + bottom simultaneous overflow (production-like)', () => {
  it('clamps both axes for wide bottom-right bubble', () => {
    const bubble = {
      left: 531.109375,
      top: 411.730712890625,
      right: 731.109375,
      bottom: 533.027587890625,
    };
    const offset = computeBubbleViewportClampOffset(bubble, PRODUCTION_AREA);
    expect(offset.x).toBeLessThanOrEqual(0);
    expect(offset.y).toBeLessThan(0);
    expect(
      isRectInsideArea(bubbleRectAfterClamp(bubble, offset), PRODUCTION_AREA, 8),
    ).toBe(true);
  });
});

describe('bubble larger than container', () => {
  it('pins oversized bubble to margins without NaN', () => {
    const bubble = { left: 10, top: 100, right: 900, bottom: 520 };
    const offset = computeBubbleViewportClampOffset(bubble, PRODUCTION_AREA);
    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
    expect(bubble.left + offset.x).toBeGreaterThanOrEqual(
      PRODUCTION_AREA.left + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
    expect(bubble.top + offset.y).toBeGreaterThanOrEqual(
      PRODUCTION_AREA.top + BUBBLE_VIEWPORT_MARGIN_PX - 0.01,
    );
  });
});

describe('clamp後再計測', () => {
  it('measureBubbleClampOffset stabilizes after clamp is applied', () => {
    const natural = {
      left: 798.758,
      top: 329.605,
      right: 869.727,
      bottom: 450.902,
    };
    const first = computeBubbleViewportClampOffset(natural, PRODUCTION_AREA);
    const clampedRect = bubbleRectAfterClamp(natural, first);
    const second = measureBubbleClampOffset(clampedRect, PRODUCTION_AREA, first);
    expect(second).toEqual(first);
    expect(
      isRectInsideArea(clampedRect, PRODUCTION_AREA, 8),
    ).toBe(true);
  });

  it('re-measures correctly when content height grows after initial clamp', () => {
    const naturalShort = {
      left: 531.109375,
      top: 387.404846,
      right: 731.109375,
      bottom: 468.701721,
    };
    const first = computeBubbleViewportClampOffset(naturalShort, PRODUCTION_AREA);
    expect(first.y).toBe(0);

    const naturalTall = {
      ...naturalShort,
      bottom: naturalShort.top + 121.296875,
    };
    const remeasured = measureBubbleClampOffset(
      bubbleRectAfterClamp(naturalTall, first),
      PRODUCTION_AREA,
      first,
    );
    expect(remeasured.y).toBeLessThan(0);
    expect(
      isRectInsideArea(bubbleRectAfterClamp(naturalTall, remeasured), PRODUCTION_AREA, 8),
    ).toBe(true);
  });
});
