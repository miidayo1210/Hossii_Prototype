import { describe, it, expect } from 'vitest';
import { canShowPersonalShortcut } from './personalSpaceShortcut';

describe('canShowPersonalShortcut', () => {
  const base = {
    isAuthenticated: true,
    isVisiting: false,
    spaceCommunityId: 'community-1',
    membershipStatus: 'active',
  };

  it('shows for authenticated active member on a community space', () => {
    expect(canShowPersonalShortcut(base)).toBe(true);
  });

  it('hides for guests (not authenticated)', () => {
    expect(canShowPersonalShortcut({ ...base, isAuthenticated: false })).toBe(false);
  });

  it('hides while visiting another space', () => {
    expect(canShowPersonalShortcut({ ...base, isVisiting: true })).toBe(false);
  });

  it('hides when the space has no community', () => {
    expect(canShowPersonalShortcut({ ...base, spaceCommunityId: null })).toBe(false);
    expect(canShowPersonalShortcut({ ...base, spaceCommunityId: undefined })).toBe(false);
  });

  it('hides for suspended members', () => {
    expect(canShowPersonalShortcut({ ...base, membershipStatus: 'suspended' })).toBe(false);
  });

  it('hides for removed members', () => {
    expect(canShowPersonalShortcut({ ...base, membershipStatus: 'removed' })).toBe(false);
  });

  it('hides when there is no membership', () => {
    expect(canShowPersonalShortcut({ ...base, membershipStatus: null })).toBe(false);
    expect(canShowPersonalShortcut({ ...base, membershipStatus: undefined })).toBe(false);
  });
});
