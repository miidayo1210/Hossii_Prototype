import { describe, expect, it } from 'vitest';
import {
  clampPullVector,
  clampVectorMagnitude,
  computeConnectedBubbleShift,
  computeDistance,
  computeDragVector,
  computeNormalizedProgress,
  computePullGlowProgress,
  clampTwoHopStarDisplayCount,
  computeTwoHopStarParticleCount,
  DEFAULT_CONNECTED_FOLLOW_RATIO,
  DEFAULT_MAX_PULL_DISTANCE_PX,
  MAX_CONNECTED_SHIFT_PX,
  REDUCED_MOTION_GLOW_CAP,
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

  it('clamps pull vector to max distance while preserving direction', () => {
    const raw = computeDragVector({ x: 0, y: 0 }, { x: 300, y: 200 });
    const clamped = clampPullVector(raw, DEFAULT_MAX_PULL_DISTANCE_PX);

    expect(computeDistance(clamped)).toBeCloseTo(DEFAULT_MAX_PULL_DISTANCE_PX, 5);
    expect(clamped.x / clamped.y).toBeCloseTo(raw.x / raw.y, 5);
    expect(clamped.x).toBeLessThan(raw.x);
    expect(clamped.y).toBeLessThan(raw.y);
  });

  it('leaves pull vector unchanged when within max distance', () => {
    const vector = { x: 40, y: 30 };
    expect(clampPullVector(vector)).toEqual(vector);
  });

  it('computes connected bubble shift with follow ratio', () => {
    const pullVector = clampPullVector({ x: 100, y: 0 });
    const shift = computeConnectedBubbleShift(pullVector, 0.5);
    expect(shift.x).toBeCloseTo(17.5, 5);
    expect(shift.y).toBe(0);
  });

  it('caps connected shift magnitude at MAX_CONNECTED_SHIFT_PX', () => {
    const pullVector = clampPullVector({ x: DEFAULT_MAX_PULL_DISTANCE_PX, y: 0 });
    const shift = computeConnectedBubbleShift(pullVector, 1, {
      followRatio: DEFAULT_CONNECTED_FOLLOW_RATIO,
      maxShift: MAX_CONNECTED_SHIFT_PX,
    });

    expect(computeDistance(shift)).toBeCloseTo(MAX_CONNECTED_SHIFT_PX, 5);
    expect(shift.x).toBeCloseTo(MAX_CONNECTED_SHIFT_PX, 5);
    expect(shift.y).toBe(0);
  });

  it('returns zero connected shift under reduced motion', () => {
    const pullVector = clampPullVector({ x: DEFAULT_MAX_PULL_DISTANCE_PX, y: 0 });
    expect(computeConnectedBubbleShift(pullVector, 1, { reducedMotion: true })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('returns 1–3 star particles by progress tier', () => {
    expect(computeTwoHopStarParticleCount(0)).toBe(1);
    expect(computeTwoHopStarParticleCount(0.4)).toBe(2);
    expect(computeTwoHopStarParticleCount(0.9)).toBe(3);
  });

  it('returns 1 star particle under reduced motion', () => {
    expect(computeTwoHopStarParticleCount(0.9, true)).toBe(1);
  });

  it('caps glow progress under reduced motion', () => {
    expect(computePullGlowProgress(1)).toBe(1);
    expect(computePullGlowProgress(1, true)).toBe(REDUCED_MOTION_GLOW_CAP);
    expect(computePullGlowProgress(0.1, true)).toBeCloseTo(0.1, 5);
  });

  it('clamps arbitrary vector magnitude', () => {
    const clamped = clampVectorMagnitude({ x: 100, y: 100 }, 50);
    expect(computeDistance(clamped)).toBeCloseTo(50, 5);
  });
});


describe('clampTwoHopStarDisplayCount', () => {
  it('clamps visible 2-hop counts to 0-3 stars', () => {
    expect(clampTwoHopStarDisplayCount(0)).toBe(0);
    expect(clampTwoHopStarDisplayCount(1)).toBe(1);
    expect(clampTwoHopStarDisplayCount(2)).toBe(2);
    expect(clampTwoHopStarDisplayCount(3)).toBe(3);
    expect(clampTwoHopStarDisplayCount(99)).toBe(3);
  });
});
