import { describe, expect, it } from 'vitest';
import { isEditedMessageValid, nextVisibilityToggle } from './ownPostEditRules';

describe('isEditedMessageValid', () => {
  it('accepts any non-empty (trimmed) message', () => {
    expect(isEditedMessageValid({}, 'hello')).toBe(true);
    expect(isEditedMessageValid({}, '  hi  ')).toBe(true);
  });

  it('rejects empty message for a text-only post', () => {
    expect(isEditedMessageValid({}, '')).toBe(false);
    expect(isEditedMessageValid({}, '   ')).toBe(false);
  });

  it('accepts empty message when the post carries other content', () => {
    expect(isEditedMessageValid({ emotion: 'joy' }, '')).toBe(true);
    expect(isEditedMessageValid({ imageUrl: 'x.png' }, '  ')).toBe(true);
    expect(isEditedMessageValid({ numberValue: 0 }, '')).toBe(true);
    expect(isEditedMessageValid({ autoType: 'laughter' }, '')).toBe(true);
  });
});

describe('nextVisibilityToggle', () => {
  it('toggles public -> owner_only', () => {
    expect(nextVisibilityToggle('public')).toBe('owner_only');
    expect(nextVisibilityToggle(undefined)).toBe('owner_only');
  });
  it('toggles owner_only -> public', () => {
    expect(nextVisibilityToggle('owner_only')).toBe('public');
  });
});
