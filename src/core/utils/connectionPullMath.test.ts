import { describe, expect, it } from 'vitest';
import {
  computeConnectedBubbleShift,
  computeDistance,
  computeDragVector,
  computeNormalizedProgress,
  computeTwoHopStarParticleCount,
  DEFAULT_MAX_PULL_DISTANCE_PX,
} from './connectionPullMath';

describe('connectionPullMath', () => {
  it('computes drag vector from origin to current', () => {
    expect(computeDragVector({ x: 10, y: 20 }, { x: 40, y: 50 })).toEqual({ x: 30, y: 30 });
  });

  it('computes distance from vector', () => {
    expect(computeDistance({ x: 3, y: 4 })).toBe(5);
  });

  it('normalizes progress against max distance', () => {
    expect(computeNormalizedProgress(60, DEFAULT_MAX_PULL_DISTANCE_PX)).toBeCloseTo(0.5, 5);
    expect(computeNormalizedProgress(999, DEFAULT_MAX_PULL_DISTANCE_PX)).toBe(1);
    expect(computeNormalizedProgress(-1, DEFAULT_MAX_PULL_DISTANCE_PX)).toBe(0);
  });

  it('computes connected bubble shift with follow ratio', () => {
    const shift = computeConnectedBubbleShift({ x: 100, y: 0 }, 0.5, 0.35);
    expect(shift.x).toBeCloseTo(17.5, 5);
    expect(shift.y).toBe(0);
  });

  it('returns 1–3 star particles by progress tier', () => {
    expect(computeTwoHopStarParticleCount(0)).toBe(1);
    expect(computeTwoHopStarParticleCount(0.4)).toBe(2);
    expect(computeTwoHopStarParticleCount(0.9)).toBe(3);
  });
});
