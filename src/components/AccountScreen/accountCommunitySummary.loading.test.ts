import { describe, expect, it } from 'vitest';
import { resolveCommunitySummaryLabel } from './accountCommunitySummary';

describe('resolveCommunitySummaryLabel', () => {
  it('returns 読み込み中 when loading', () => {
    expect(resolveCommunitySummaryLabel(true, false, null)).toBe('読み込み中');
  });

  it('delegates to resolveCommunitySummary when not loading', () => {
    expect(resolveCommunitySummaryLabel(false, true, 'Dev Community')).toBe('Dev Community');
    expect(resolveCommunitySummaryLabel(false, false, null)).toBe('未ログイン');
  });
});
