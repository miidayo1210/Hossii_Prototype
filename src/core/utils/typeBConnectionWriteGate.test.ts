import { describe, it, expect } from 'vitest';
import type { AppUser } from '../contexts/AuthContext';
import type { Space } from '../types/space';
import type { ActiveSpaceMembershipStatus } from './membershipJoinController';
import { evaluateTypeBConnectionWriteGate } from './typeBConnectionWriteGate';

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    uid: 'user-1',
    email: 'user@test',
    displayName: 'User',
    isAdmin: false,
    communityId: 'comm-1',
    ...overrides,
  };
}

function makeSpace(overrides: Partial<Space> = {}): Space {
  return {
    id: 'space-1',
    name: 'Test',
    communityId: 'comm-1',
    ...overrides,
  } as Space;
}

function evaluate(status: ActiveSpaceMembershipStatus, overrides: Partial<Parameters<typeof evaluateTypeBConnectionWriteGate>[0]> = {}) {
  return evaluateTypeBConnectionWriteGate({
    currentUser: makeUser(),
    activeSpace: makeSpace(),
    isContentArchived: false,
    activeSpaceMembershipStatus: status,
    ...overrides,
  });
}

describe('evaluateTypeBConnectionWriteGate', () => {
  it('allows active member create', () => {
    expect(evaluate('active')).toEqual({
      canCreate: true,
      blockReason: null,
      bypassesMembership: false,
    });
  });

  it('blocks idle create', () => {
    expect(evaluate('idle')).toEqual({
      canCreate: false,
      blockReason: 'membership_joining',
      bypassesMembership: false,
    });
  });

  it('blocks joining create', () => {
    expect(evaluate('joining')).toEqual({
      canCreate: false,
      blockReason: 'membership_joining',
      bypassesMembership: false,
    });
  });

  it('blocks error create', () => {
    expect(evaluate('error')).toEqual({
      canCreate: false,
      blockReason: 'membership_error',
      bypassesMembership: false,
    });
  });

  it('blocks none membership create', () => {
    expect(evaluate('none')).toEqual({
      canCreate: false,
      blockReason: 'membership_none',
      bypassesMembership: false,
    });
  });

  it('blocks guest create', () => {
    expect(
      evaluateTypeBConnectionWriteGate({
        currentUser: null,
        activeSpace: makeSpace(),
        isContentArchived: false,
        activeSpaceMembershipStatus: 'active',
      }),
    ).toEqual({
      canCreate: false,
      blockReason: 'guest',
      bypassesMembership: false,
    });
  });

  it('allows personal owner with none membership', () => {
    expect(
      evaluateTypeBConnectionWriteGate({
        currentUser: makeUser({ uid: 'owner-1' }),
        activeSpace: makeSpace({ spaceType: 'personal', ownerUserId: 'owner-1' }),
        isContentArchived: false,
        activeSpaceMembershipStatus: 'none',
      }),
    ).toEqual({
      canCreate: true,
      blockReason: null,
      bypassesMembership: true,
    });
  });

  it('allows community admin with none membership', () => {
    expect(
      evaluateTypeBConnectionWriteGate({
        currentUser: makeUser({ isAdmin: true, communityId: 'comm-1' }),
        activeSpace: makeSpace({ communityId: 'comm-1' }),
        isContentArchived: false,
        activeSpaceMembershipStatus: 'none',
      }),
    ).toEqual({
      canCreate: true,
      blockReason: null,
      bypassesMembership: true,
    });
  });

  it('allows super admin with none membership', () => {
    expect(
      evaluateTypeBConnectionWriteGate({
        currentUser: makeUser({ isSuperAdmin: true, communityId: 'other' }),
        activeSpace: makeSpace({ communityId: 'comm-1' }),
        isContentArchived: false,
        activeSpaceMembershipStatus: 'none',
      }),
    ).toEqual({
      canCreate: true,
      blockReason: null,
      bypassesMembership: true,
    });
  });

  it('blocks archived even for admin', () => {
    expect(
      evaluateTypeBConnectionWriteGate({
        currentUser: makeUser({ isAdmin: true, communityId: 'comm-1' }),
        activeSpace: makeSpace({ communityId: 'comm-1' }),
        isContentArchived: true,
        activeSpaceMembershipStatus: 'active',
      }),
    ).toEqual({
      canCreate: false,
      blockReason: 'archived',
      bypassesMembership: false,
    });
  });
});
