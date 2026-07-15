import { describe, expect, it } from 'vitest';
import { resolveCommunitySummary } from './accountCommunitySummary';

describe('resolveCommunitySummary', () => {
  it('returns 未ログイン for guest', () => {
    expect(resolveCommunitySummary(false, 'Dev Community')).toBe('未ログイン');
  });

  it('returns 未所属 when logged in without community', () => {
    expect(resolveCommunitySummary(true, null)).toBe('未所属');
  });

  it('returns community name when selected', () => {
    expect(resolveCommunitySummary(true, 'Dev Community')).toBe('Dev Community');
  });
});
