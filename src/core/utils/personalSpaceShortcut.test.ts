import { describe, it, expect } from 'vitest';
import {
  canShowPersonalShortcut,
  getPersonalShortcutHiddenReason,
  isSharedSpaceShell,
  isViewingOwnPersonalSpace,
} from './personalSpaceShortcut';

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

describe('getPersonalShortcutHiddenReason', () => {
  const base = {
    isAuthenticated: true,
    isVisiting: false,
    spaceCommunityId: 'community-1',
    membershipStatus: 'active',
  };

  it('returns null for active members (tab visible)', () => {
    expect(getPersonalShortcutHiddenReason(base)).toBeNull();
  });

  it('returns null while visiting', () => {
    expect(
      getPersonalShortcutHiddenReason({ ...base, isVisiting: true, membershipStatus: 'suspended' }),
    ).toBeNull();
  });

  it('explains suspended membership', () => {
    expect(getPersonalShortcutHiddenReason({ ...base, membershipStatus: 'suspended' })).toMatch(
      /一時停止/,
    );
  });

  it('explains guest / login needed', () => {
    expect(
      getPersonalShortcutHiddenReason({
        ...base,
        isAuthenticated: false,
        membershipStatus: undefined,
      }),
    ).toBe('ログインすると、マイスペースタブが使えるようになります。');
  });
});

describe('isSharedSpaceShell', () => {
  it('treats shared and undefined as shared shell', () => {
    expect(isSharedSpaceShell('shared')).toBe(true);
    expect(isSharedSpaceShell(undefined)).toBe(true);
    expect(isSharedSpaceShell(null)).toBe(true);
  });

  it('treats personal as non-shell', () => {
    expect(isSharedSpaceShell('personal')).toBe(false);
  });
});

describe('isViewingOwnPersonalSpace', () => {
  const uid = 'user-1';

  it('is not active on a shared space', () => {
    expect(
      isViewingOwnPersonalSpace({
        spaceType: 'shared',
        spaceOwnerUserId: undefined,
        currentUserId: uid,
      }),
    ).toBe(false);
  });

  it('is active when viewing own personal space (space_type + owner_user_id match auth.uid)', () => {
    expect(
      isViewingOwnPersonalSpace({
        spaceType: 'personal',
        spaceOwnerUserId: uid,
        currentUserId: uid,
      }),
    ).toBe(true);
  });

  it("is not active on another person's personal space (e.g. admin viewing a member's space)", () => {
    expect(
      isViewingOwnPersonalSpace({
        spaceType: 'personal',
        spaceOwnerUserId: 'someone-else',
        currentUserId: uid,
      }),
    ).toBe(false);
  });

  it('is not active for guests / unauthenticated (no current user)', () => {
    expect(
      isViewingOwnPersonalSpace({
        spaceType: 'personal',
        spaceOwnerUserId: uid,
        currentUserId: null,
      }),
    ).toBe(false);
    expect(
      isViewingOwnPersonalSpace({
        spaceType: 'personal',
        spaceOwnerUserId: uid,
        currentUserId: undefined,
      }),
    ).toBe(false);
  });

  it('is not active when owner is unknown even if space_type is personal', () => {
    expect(
      isViewingOwnPersonalSpace({
        spaceType: 'personal',
        spaceOwnerUserId: null,
        currentUserId: uid,
      }),
    ).toBe(false);
  });
});
