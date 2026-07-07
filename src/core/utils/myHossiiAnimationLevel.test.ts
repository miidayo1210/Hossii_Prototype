import { describe, expect, it } from 'vitest';
import { resolveMyHossiiAnimationTier } from './myHossiiAnimationLevel';

describe('resolveMyHossiiAnimationTier', () => {
  it('returns full for 1-5 participants', () => {
    expect(resolveMyHossiiAnimationTier(1)).toBe('full');
    expect(resolveMyHossiiAnimationTier(5)).toBe('full');
  });

  it('returns light for 6-12 participants', () => {
    expect(resolveMyHossiiAnimationTier(6)).toBe('light');
    expect(resolveMyHossiiAnimationTier(12)).toBe('light');
  });

  it('returns none for 13+ participants', () => {
    expect(resolveMyHossiiAnimationTier(13)).toBe('none');
    expect(resolveMyHossiiAnimationTier(20)).toBe('none');
  });
});
