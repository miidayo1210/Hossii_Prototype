import { describe, expect, it } from 'vitest';
import { normalizeSpaceNickname, MAX_SPACE_NICKNAME_LENGTH } from './spaceNicknameRules';

describe('normalizeSpaceNickname', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeSpaceNickname('  たろう  ')).toEqual({ ok: true, value: 'たろう' });
  });

  it('treats empty / whitespace-only as null (unset)', () => {
    expect(normalizeSpaceNickname('')).toEqual({ ok: true, value: null });
    expect(normalizeSpaceNickname('   ')).toEqual({ ok: true, value: null });
  });

  it('accepts a value at the max length', () => {
    const v = 'a'.repeat(MAX_SPACE_NICKNAME_LENGTH);
    expect(normalizeSpaceNickname(v)).toEqual({ ok: true, value: v });
  });

  it('rejects too-long values', () => {
    const v = 'a'.repeat(MAX_SPACE_NICKNAME_LENGTH + 1);
    expect(normalizeSpaceNickname(v)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('rejects control characters', () => {
    expect(normalizeSpaceNickname('bad\u0000name')).toEqual({ ok: false, reason: 'control_char' });
    expect(normalizeSpaceNickname('tab\tname')).toEqual({ ok: false, reason: 'control_char' });
  });
});
