import { describe, expect, it } from 'vitest';
import { clampConnectionReasonTooltipPosition } from './connectionReasonTooltipPosition';

const overlayRect = { left: 100, top: 50 };
const viewport = { viewportWidth: 800, viewportHeight: 600 };
const tooltipSize = { tooltipWidth: 120, tooltipHeight: 28 };

describe('clampConnectionReasonTooltipPosition', () => {
  it('keeps pointer offset in the center of the viewport', () => {
    const result = clampConnectionReasonTooltipPosition({
      clientX: 400,
      clientY: 300,
      overlayRect,
      ...tooltipSize,
      ...viewport,
    });

    expect(result).toEqual({
      left: 400 + 12 - overlayRect.left,
      top: 300 + 12 - overlayRect.top,
    });
  });

  it('shifts inward near the right edge', () => {
    const result = clampConnectionReasonTooltipPosition({
      clientX: 760,
      clientY: 300,
      overlayRect,
      ...tooltipSize,
      ...viewport,
    });

    expect(result.left).toBe(800 - 120 - 8 - overlayRect.left);
    expect(result.top).toBe(300 + 12 - overlayRect.top);
  });

  it('shifts inward near the bottom edge', () => {
    const result = clampConnectionReasonTooltipPosition({
      clientX: 400,
      clientY: 580,
      overlayRect,
      ...tooltipSize,
      ...viewport,
    });

    expect(result.left).toBe(400 + 12 - overlayRect.left);
    expect(result.top).toBe(600 - 28 - 8 - overlayRect.top);
  });

  it('keeps the tooltip inside the viewport near the top-left corner', () => {
    const result = clampConnectionReasonTooltipPosition({
      clientX: -10,
      clientY: -10,
      overlayRect,
      ...tooltipSize,
      ...viewport,
    });

    expect(result.left).toBe(8 - overlayRect.left);
    expect(result.top).toBe(8 - overlayRect.top);
  });
});
