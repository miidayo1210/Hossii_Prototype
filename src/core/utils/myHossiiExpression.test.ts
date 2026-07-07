import { describe, expect, it } from 'vitest';
import {
  deriveMyHossiiDisplayState,
  isRecentlyActive,
  resolveActivityScale,
  MY_HOSSII_RECENT_ACTIVITY_MS,
} from './myHossiiExpression';

describe('myHossiiExpression', () => {
  it('marks recent activity within 3 days', () => {
    const now = Date.now();
    const recent = new Date(now - MY_HOSSII_RECENT_ACTIVITY_MS + 1000);
    expect(isRecentlyActive(recent, now)).toBe(true);
  });

  it('scales up recently active users only', () => {
    const now = Date.now();
    const recent = new Date(now - 1000);
    const old = new Date(now - MY_HOSSII_RECENT_ACTIVITY_MS - 1000);
    expect(resolveActivityScale(recent, now)).toBeGreaterThan(1);
    expect(resolveActivityScale(old, now)).toBe(1);
  });

  it('derives quiet state when no posts', () => {
    expect(deriveMyHossiiDisplayState({ recentPosts: [], lastActivityAt: null })).toBe('quiet');
  });
});
