import { describe, expect, it } from 'vitest';
import {
  BUBBLE_VIEWPORT_MARGIN_PX,
  computeBubbleViewportClampOffset,
  measureBubbleClampOffset,
  rectWithoutTranslate,
} from './customBubbleLandscapePlacement';

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
