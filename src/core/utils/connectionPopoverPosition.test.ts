import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  clampPopoverHorizontal,
  computePopoverBottomAboveAnchor,
  CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT,
  CONNECTION_POPOVER_VIEWPORT_MARGIN,
} from './connectionPopoverPosition';

describe('clampPopoverHorizontal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps popover inside viewport horizontally', () => {
    vi.stubGlobal('window', {
      innerWidth: 400,
    } as Window);

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
    vi.stubGlobal('window', {
      innerHeight: 600,
    } as Window);

    expect(computePopoverBottomAboveAnchor(500, 10, 80)).toBe(110);
  });

  it('clamps bottom when anchor is near the top on short viewports', () => {
    vi.stubGlobal('window', {
      innerHeight: 390,
    } as Window);

    const bottom = computePopoverBottomAboveAnchor(20, 10, CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT);
    expect(bottom).toBeLessThan(390 - 20 + 10);
    expect(bottom).toBe(390 - CONNECTION_POPOVER_VIEWPORT_MARGIN - CONNECTION_POPOVER_ESTIMATED_MAX_HEIGHT);
  });
});
