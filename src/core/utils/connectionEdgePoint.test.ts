import { describe, expect, it } from 'vitest';
import { getRectEdgePointTowardTarget, rectCenter } from './connectionEdgePoint';

describe('getRectEdgePointTowardTarget', () => {
  const rect = { left: 100, top: 100, width: 200, height: 100 };

  it('hits right edge when target is to the right', () => {
    const target = { x: 400, y: 150 };
    const point = getRectEdgePointTowardTarget(rect, target);
    expect(point.x).toBeCloseTo(300, 1);
    expect(point.y).toBeCloseTo(150, 1);
  });

  it('hits left edge when target is to the left', () => {
    const target = { x: 0, y: 150 };
    const point = getRectEdgePointTowardTarget(rect, target);
    expect(point.x).toBeCloseTo(100, 1);
    expect(point.y).toBeCloseTo(150, 1);
  });

  it('hits top edge when target is above', () => {
    const target = { x: 200, y: 0 };
    const point = getRectEdgePointTowardTarget(rect, target);
    expect(point.x).toBeCloseTo(200, 1);
    expect(point.y).toBeCloseTo(100, 1);
  });

  it('respects insets and stays inside padded rect boundary', () => {
    const target = { x: 400, y: 150 };
    const insets = { top: 14, right: 14, bottom: 14, left: 14 };
    const point = getRectEdgePointTowardTarget(rect, target, insets);
    expect(point.x).toBeLessThan(300);
    expect(point.x).toBeGreaterThan(rectCenter(rect).x);
  });
});
