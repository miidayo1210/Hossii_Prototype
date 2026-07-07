import { describe, expect, it } from 'vitest';
import { computeMyHossiiPosition, resolveMyHossiiMotionMode } from './myHossiiPosition';

describe('computeMyHossiiPosition', () => {
  it('returns stable position for same userId and spaceId', () => {
    const a = computeMyHossiiPosition('user-1', 'space-1', 0);
    const b = computeMyHossiiPosition('user-1', 'space-1', 0);
    expect(a).toEqual(b);
  });

  it('returns different positions for different users', () => {
    const a = computeMyHossiiPosition('user-1', 'space-1', 0);
    const b = computeMyHossiiPosition('user-2', 'space-1', 0);
    expect(a.x !== b.x || a.y !== b.y).toBe(true);
  });

  it('keeps positions within safe bounds', () => {
    const pos = computeMyHossiiPosition('abc', 'space-x', 3);
    expect(pos.x).toBeGreaterThanOrEqual(10);
    expect(pos.x).toBeLessThanOrEqual(88);
    expect(pos.y).toBeGreaterThanOrEqual(14);
    expect(pos.y).toBeLessThanOrEqual(78);
  });
});

describe('resolveMyHossiiMotionMode', () => {
  it('returns static when prefers reduced motion', () => {
    expect(
      resolveMyHossiiMotionMode('free', {
        participantCount: 2,
        visiblePostCount: 2,
        prefersReducedMotion: true,
      }),
    ).toBe('static');
  });

  it('returns anchored when configured', () => {
    expect(
      resolveMyHossiiMotionMode('anchored', {
        participantCount: 2,
        visiblePostCount: 2,
        prefersReducedMotion: false,
      }),
    ).toBe('anchored');
  });

  it('auto becomes static when crowded', () => {
    expect(
      resolveMyHossiiMotionMode('auto', {
        participantCount: 12,
        visiblePostCount: 30,
        prefersReducedMotion: false,
      }),
    ).toBe('static');
  });
});
