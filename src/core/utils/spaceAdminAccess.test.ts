import { describe, expect, it } from 'vitest';
import type { AppUser } from '../contexts/AuthContext';
import type { Space } from '../types/space';
import { canManageSpace } from './spaceAdminAccess';

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
