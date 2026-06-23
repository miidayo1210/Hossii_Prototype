import { describe, expect, it } from 'vitest';
import {
  computeSharpContentRect,
  mapContainerPercentToLogical,
  mapLogicalToContainerPercent,
} from './sharpContentRect';

describe('computeSharpContentRect', () => {
  it('letterboxes top/bottom on portrait container', () => {
    const rect = computeSharpContentRect(390, 844);
    expect(rect.y).toBeGreaterThan(0);
    expect(rect.x).toBe(0);
    expect(rect.width).toBe(390);
    expect(rect.height).toBeCloseTo(390 / (16 / 9), 1);
  });

  it('letterboxes left/right on landscape container', () => {
    const rect = computeSharpContentRect(1200, 600);
    expect(rect.x).toBeGreaterThan(0);
    expect(rect.y).toBe(0);
    expect(rect.height).toBe(600);
    expect(rect.width).toBeCloseTo(600 * (16 / 9), 1);
  });
});

describe('mapContainerPercentToLogical', () => {
  const W = 390;
  const H = 844;

  it('maps sharp center container % to (50, 50) logical', () => {
    const sharp = computeSharpContentRect(W, H);
    const cx = ((sharp.x + sharp.width / 2) / W) * 100;
    const cy = ((sharp.y + sharp.height / 2) / H) * 100;
    const logical = mapContainerPercentToLogical(cx, cy, W, H);
    expect(logical.x).toBeCloseTo(50, 1);
    expect(logical.y).toBeCloseTo(50, 1);
  });

  it('clamps container corners to 0 or 100 logical', () => {
    const topLeft = mapContainerPercentToLogical(0, 0, W, H);
    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBe(0);

    const bottomRight = mapContainerPercentToLogical(100, 100, W, H);
    expect(bottomRight.x).toBe(100);
    expect(bottomRight.y).toBe(100);
  });

  it('passthrough when container dimensions are zero', () => {
    expect(mapContainerPercentToLogical(42, 58, 0, 844)).toEqual({ x: 42, y: 58 });
  });
});

describe('logical ↔ container roundtrip', () => {
  it('returns to original logical coords within tolerance', () => {
    const W = 390;
    const H = 844;
    const lx = 50;
    const ly = 50;
    const container = mapLogicalToContainerPercent(lx, ly, W, H);
    const back = mapContainerPercentToLogical(container.x, container.y, W, H);
    expect(back.x).toBeCloseTo(lx, 2);
    expect(back.y).toBeCloseTo(ly, 2);
  });
});
