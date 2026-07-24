import { describe, expect, it } from 'vitest';
import {
  TYPE_B_PLACEMENT_DEFAULT_BOUNDS,
  TYPE_B_PLACEMENT_DEFAULT_MIN_DISTANCE,
  clampTypeBPlacementPoint,
  computeTypeBNearOriginPlacement,
  typeBPlacementCollides,
} from './typeBNearOriginPlacement';

const MIN = TYPE_B_PLACEMENT_DEFAULT_MIN_DISTANCE;

function expectWithinBounds(x: number, y: number, margin = 0) {
  expect(x).toBeGreaterThanOrEqual(TYPE_B_PLACEMENT_DEFAULT_BOUNDS.min + margin);
  expect(x).toBeLessThanOrEqual(TYPE_B_PLACEMENT_DEFAULT_BOUNDS.max - margin);
  expect(y).toBeGreaterThanOrEqual(TYPE_B_PLACEMENT_DEFAULT_BOUNDS.min + margin);
  expect(y).toBeLessThanOrEqual(TYPE_B_PLACEMENT_DEFAULT_BOUNDS.max - margin);
}

describe('computeTypeBNearOriginPlacement', () => {
  it('places to the right of the origin in a normal open area', () => {
    const origin = { x: 50, y: 50 };
    const result = computeTypeBNearOriginPlacement({
      origin,
      existingPositions: [origin],
    });

    expect(result.positionX).toBeCloseTo(57, 5);
    expect(result.positionY).toBeCloseTo(50, 5);
    expectWithinBounds(result.positionX, result.positionY);
  });

  it('corrects inward near the right edge', () => {
    const origin = { x: 88, y: 50 };
    const result = computeTypeBNearOriginPlacement({
      origin,
      existingPositions: [origin],
      minimumDistance: 10,
    });

    expect(result.positionX).toBe(98);
    expect(result.positionY).toBeCloseTo(50, 5);
    expectWithinBounds(result.positionX, result.positionY);
  });

  it('corrects inward near the top and bottom edges', () => {
    const top = computeTypeBNearOriginPlacement({
      origin: { x: 50, y: 8 },
      existingPositions: [{ x: 50, y: 8 }],
      minimumDistance: 10,
    });
    expect(top.positionX).toBeCloseTo(60, 5);
    expect(top.positionY).toBeCloseTo(8, 5);
    expectWithinBounds(top.positionX, top.positionY);

    const bottom = computeTypeBNearOriginPlacement({
      origin: { x: 50, y: 92 },
      existingPositions: [{ x: 50, y: 92 }],
      minimumDistance: 10,
    });
    expect(bottom.positionX).toBeCloseTo(60, 5);
    expect(bottom.positionY).toBeCloseTo(92, 5);
    expectWithinBounds(bottom.positionX, bottom.positionY);
  });

  it('uses the next angle when the first right candidate collides', () => {
    const origin = { x: 50, y: 50 };
    const blocker = { x: 57, y: 50 };
    const result = computeTypeBNearOriginPlacement({
      origin,
      existingPositions: [origin, blocker],
      minimumDistance: MIN,
    });

    expect(result.positionX).not.toBeCloseTo(57, 5);
    expect(
      typeBPlacementCollides(
        { x: result.positionX, y: result.positionY },
        [origin, blocker],
        MIN,
      ),
    ).toBe(false);
    expectWithinBounds(result.positionX, result.positionY);
  });

  it('expands radius when multiple angle candidates collide', () => {
    const origin = { x: 50, y: 50 };
    const ring = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return {
        x: origin.x + MIN * Math.cos(rad),
        y: origin.y + MIN * Math.sin(rad),
      };
    });

    const result = computeTypeBNearOriginPlacement({
      origin,
      existingPositions: [origin, ...ring],
      minimumDistance: MIN,
    });

    const placed = { x: result.positionX, y: result.positionY };
    expect(typeBPlacementCollides(placed, [origin, ...ring], MIN)).toBe(false);
    expect(distanceFromOrigin(placed, origin)).toBeGreaterThan(MIN);
    expectWithinBounds(result.positionX, result.positionY);
  });

  it('returns the same result for identical input', () => {
    const input = {
      origin: { x: 40, y: 60 },
      existingPositions: [
        { x: 40, y: 60 },
        { x: 52, y: 60 },
        { x: 46, y: 68 },
      ] as const,
      seed: 'type-b-seed-1',
      minimumDistance: 11,
      margin: 2,
    };

    const a = computeTypeBNearOriginPlacement(input);
    const b = computeTypeBNearOriginPlacement(input);
    expect(a).toEqual(b);
  });

  it('always stays within bounds and margin', () => {
    const cases = [
      { origin: { x: 2, y: 2 }, margin: 3 },
      { origin: { x: 98, y: 98 }, margin: 3 },
      { origin: { x: 50, y: 50 }, margin: 5 },
    ];

    for (const testCase of cases) {
      const result = computeTypeBNearOriginPlacement({
        origin: testCase.origin,
        existingPositions: [testCase.origin, { x: 57, y: 50 }, { x: 50, y: 57 }],
        margin: testCase.margin,
      });
      expectWithinBounds(result.positionX, result.positionY, testCase.margin);
    }
  });
});

describe('clampTypeBPlacementPoint', () => {
  it('clamps to bounds with margin', () => {
    expect(
      clampTypeBPlacementPoint(
        { x: 120, y: -5 },
        TYPE_B_PLACEMENT_DEFAULT_BOUNDS,
        2,
      ),
    ).toEqual({ x: 98, y: 2 });
  });
});

function distanceFromOrigin(
  point: { x: number; y: number },
  origin: { x: number; y: number },
): number {
  return Math.hypot(point.x - origin.x, point.y - origin.y);
}
