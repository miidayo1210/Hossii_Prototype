import { describe, expect, it } from 'vitest';
import type { AppUser } from '../contexts/AuthContext';
import type { Space } from '../types/space';
import type { SpaceMembership } from '../types/spaceMembership';
import {
  canManageSpace,
  canManageSpaceArchive,
  isActiveSpaceMembershipAdmin,
} from './spaceAdminAccess';

const baseSpace: Space = {
  id: 's1',
  name: 'Test',
  quickEmotions: [],
  createdAt: new Date(),
  communityId: 'community-a',
};

const communityAdmin: AppUser = {
  uid: 'admin-a',
  email: 'admin@example.test',
  displayName: 'Admin A',
  isAdmin: true,
  communityId: 'community-a',
  communityStatus: 'approved',
};

const otherCommunityAdmin: AppUser = {
  ...communityAdmin,
  uid: 'admin-b',
  communityId: 'community-b',
};

const superAdmin: AppUser = {
  uid: 'super',
  email: 'super@example.test',
  displayName: 'Super',
  isAdmin: true,
  isSuperAdmin: true,
};

const participant: AppUser = {
  uid: 'user',
  email: 'user@example.test',
  displayName: 'User',
  isAdmin: false,
};

describe('canManageSpace', () => {
  it('allows super_admin for any space', () => {
    expect(canManageSpace(superAdmin, baseSpace)).toBe(true);
    expect(canManageSpace(superAdmin, { ...baseSpace, communityId: 'other' })).toBe(true);
  });

  it('allows community admin for own community space', () => {
    expect(canManageSpace(communityAdmin, baseSpace)).toBe(true);
  });

  it('denies community admin for another community space', () => {
    expect(canManageSpace(otherCommunityAdmin, baseSpace)).toBe(false);
  });

  it('denies non-admin participant', () => {
    expect(canManageSpace(participant, baseSpace)).toBe(false);
  });

  it('denies when communityId is missing on space', () => {
    expect(canManageSpace(communityAdmin, { ...baseSpace, communityId: undefined })).toBe(false);
  });

  it('denies when communityId is missing on user', () => {
    expect(
      canManageSpace({ ...communityAdmin, communityId: undefined }, baseSpace),
    ).toBe(false);
  });
});

const activeSpaceAdminMembership: SpaceMembership = {
  id: 'm1',
  spaceId: 's1',
  authUserId: 'user',
  role: 'admin',
  status: 'active',
  spaceNickname: null,
  joinedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('isActiveSpaceMembershipAdmin', () => {
  it('returns true for active admin/owner', () => {
    expect(isActiveSpaceMembershipAdmin(activeSpaceAdminMembership)).toBe(true);
    expect(
      isActiveSpaceMembershipAdmin({ ...activeSpaceAdminMembership, role: 'owner' }),
    ).toBe(true);
  });

  it('returns false for member or inactive', () => {
    expect(
      isActiveSpaceMembershipAdmin({ ...activeSpaceAdminMembership, role: 'member' }),
    ).toBe(false);
    expect(
      isActiveSpaceMembershipAdmin({ ...activeSpaceAdminMembership, status: 'removed' }),
    ).toBe(false);
  });
});

describe('canManageSpaceArchive', () => {
  it('allows community admin and super_admin', () => {
    expect(canManageSpaceArchive(communityAdmin, baseSpace, null)).toBe(true);
    expect(canManageSpaceArchive(superAdmin, baseSpace, null)).toBe(true);
  });

  it('allows active space admin membership', () => {
    expect(canManageSpaceArchive(participant, baseSpace, activeSpaceAdminMembership)).toBe(true);
  });

  it('denies general member without admin roles', () => {
    expect(canManageSpaceArchive(participant, baseSpace, null)).toBe(false);
    expect(
      canManageSpaceArchive(participant, baseSpace, {
        ...activeSpaceAdminMembership,
        role: 'member',
      }),
    ).toBe(false);
  });
});
