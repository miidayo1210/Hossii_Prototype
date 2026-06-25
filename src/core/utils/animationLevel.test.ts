import { describe, expect, it } from 'vitest';
import type { AnimationLevel } from './animationLevel';
import { defaultAnimationLevelByIndex, displayStackZFromIndex, resolveAnimationLevel } from './animationLevel';

describe('animationLevel', () => {
  it('defaultAnimationLevelByIndex tiers', () => {
    expect(defaultAnimationLevelByIndex(0)).toBe('full');
    expect(defaultAnimationLevelByIndex(9)).toBe('full');
    expect(defaultAnimationLevelByIndex(10)).toBe('light');
    expect(defaultAnimationLevelByIndex(29)).toBe('light');
    expect(defaultAnimationLevelByIndex(30)).toBe('none');
  });

  it('resolveAnimationLevel promotes full', () => {
    expect(
      resolveAnimationLevel(50, { promoteFull: true }),
    ).toBe('full' satisfies AnimationLevel);
  });

  it('resolveAnimationLevel promotes light from none', () => {
    expect(resolveAnimationLevel(40, { promoteLight: true })).toBe('light');
  });

  it('displayStackZFromIndex puts newer posts in front', () => {
    expect(displayStackZFromIndex(0)).toBe(80);
    expect(displayStackZFromIndex(29)).toBe(51);
    expect(displayStackZFromIndex(30)).toBe(15);
    expect(displayStackZFromIndex(0)).toBeGreaterThan(displayStackZFromIndex(29));
    expect(displayStackZFromIndex(29)).toBeGreaterThan(displayStackZFromIndex(30));
  });
});
