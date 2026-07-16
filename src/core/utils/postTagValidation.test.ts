import { describe, expect, it } from 'vitest';
import {
  hasCommittedTags,
  isTagsFieldSatisfied,
  normalizeTagInput,
} from './postTagValidation';

describe('normalizeTagInput', () => {
  it('空白のみは未入力', () => {
    expect(normalizeTagInput('   ')).toBeNull();
    expect(normalizeTagInput('#   ')).toBeNull();
    expect(normalizeTagInput('＃')).toBeNull();
  });

  it('先頭の # / ＃ を除去して正規化する', () => {
    expect(normalizeTagInput('#idea')).toBe('idea');
    expect(normalizeTagInput('＃idea')).toBe('idea');
    expect(normalizeTagInput('  #  idea  ')).toBe('idea');
  });
});

describe('hasCommittedTags', () => {
  it('プリセット・確定チップ・未確定入力のいずれかで true', () => {
    expect(hasCommittedTags([], ['preset'], '')).toBe(true);
    expect(hasCommittedTags(['free'], [], '')).toBe(true);
    expect(hasCommittedTags([], [], 'idea')).toBe(true);
    expect(hasCommittedTags([], [], '#idea')).toBe(true);
  });

  it('未入力では false', () => {
    expect(hasCommittedTags([], [], '')).toBe(false);
    expect(hasCommittedTags([], [], '   ')).toBe(false);
  });
});

describe('isTagsFieldSatisfied', () => {
  const required = { enabled: true, required: true };
  const optional = { enabled: true, required: false };
  const hidden = { enabled: false, required: true };

  it('表示OFFでは常に充足', () => {
    expect(isTagsFieldSatisfied(hidden, [], [], '')).toBe(true);
  });

  it('任意では未入力でも充足', () => {
    expect(isTagsFieldSatisfied(optional, [], [], '')).toBe(true);
  });

  it('必須では未入力で不足', () => {
    expect(isTagsFieldSatisfied(required, [], [], '')).toBe(false);
    expect(isTagsFieldSatisfied(required, [], [], '   ')).toBe(false);
  });

  it('必須でも入力後は充足', () => {
    expect(isTagsFieldSatisfied(required, ['idea'], [], '')).toBe(true);
    expect(isTagsFieldSatisfied(required, [], ['preset'], '')).toBe(true);
    expect(isTagsFieldSatisfied(required, [], [], 'idea')).toBe(true);
  });
});
