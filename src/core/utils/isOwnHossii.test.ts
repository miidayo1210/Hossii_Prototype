import { describe, it, expect } from 'vitest';
import { isOwnHossii } from './isOwnHossii';

describe('isOwnHossii', () => {
  const hossii = { id: 'h1', authorId: 'profile-a' };

  it('returns true when hossii id is in myAuthorshipIds', () => {
    expect(isOwnHossii(hossii, new Set(['h1']), 'profile-b')).toBe(true);
  });

  it('returns true when authorId matches guest profile id', () => {
    expect(isOwnHossii(hossii, new Set(), 'profile-a')).toBe(true);
  });

  it('returns false when neither authorship nor profile matches', () => {
    expect(isOwnHossii(hossii, new Set(['h2']), 'profile-b')).toBe(false);
  });

  it('returns false when guest profile id is undefined and no authorship', () => {
    expect(isOwnHossii(hossii, new Set(), undefined)).toBe(false);
  });
});
