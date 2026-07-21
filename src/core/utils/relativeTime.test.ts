import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPostDateLabel } from './relativeTime';

describe('formatPostDateLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats same-year dates without year', () => {
    expect(formatPostDateLabel(new Date('2026-07-21T09:30:00'))).toBe('7月21日');
  });

  it('formats other-year dates with year', () => {
    expect(formatPostDateLabel(new Date('2025-03-05T09:30:00'))).toBe('2025年3月5日');
  });

  it('returns null for invalid dates', () => {
    expect(formatPostDateLabel(new Date('invalid'))).toBeNull();
    expect(formatPostDateLabel(null as unknown as Date)).toBeNull();
  });
});
