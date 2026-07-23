import { describe, expect, it } from 'vitest';
import { formatConnectionCreateBlockedReasonMessage } from './formatConnectionCreateBlockedReasonMessage';

describe('formatConnectionCreateBlockedReasonMessage', () => {
  it('returns guest message', () => {
    expect(formatConnectionCreateBlockedReasonMessage('guest')).toBe(
      '参加すると、つながりを作れます',
    );
  });

  it('returns membership_none message', () => {
    expect(formatConnectionCreateBlockedReasonMessage('membership_none')).toBe(
      'このスペースに参加すると作れます',
    );
  });

  it('returns archived message', () => {
    expect(formatConnectionCreateBlockedReasonMessage('archived')).toBe(
      'アーカイブ中は編集できません',
    );
  });

  it('returns null for joining and error states', () => {
    expect(formatConnectionCreateBlockedReasonMessage('membership_joining')).toBeNull();
    expect(formatConnectionCreateBlockedReasonMessage('membership_error')).toBeNull();
    expect(formatConnectionCreateBlockedReasonMessage(null)).toBeNull();
  });
});
