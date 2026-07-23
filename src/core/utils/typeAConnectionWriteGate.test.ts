import { describe, it, expect } from 'vitest';
import type { AppUser } from '../contexts/AuthContext';
import type { HossiiConnection } from '../types/hossiiConnection';
import type { Space } from '../types/space';
import type { ActiveSpaceMembershipStatus } from './membershipJoinController';
import {
  canEditTypeAConnection,
  evaluateTypeAConnectionWriteGate,
} from './typeAConnectionWriteGate';

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

function makeConnection(overrides: Partial<HossiiConnection> = {}): HossiiConnection {
  return {
    id: 'conn-1',
    spaceId: 'space-1',
    paneId: 'pane-1',
    sourceHossiiId: 'h1',
    targetHossiiId: 'h2',
    strength: 'medium',
    reasonText: null,
    reasonEmoji: null,
    createdBy: 'user-1',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

function evaluate(status: ActiveSpaceMembershipStatus, overrides: Partial<Parameters<typeof evaluateTypeAConnectionWriteGate>[0]> = {}) {
  return evaluateTypeAConnectionWriteGate({
    currentUser: makeUser(),
    activeSpace: makeSpace(),
    isContentArchived: false,
    activeSpaceMembershipStatus: status,
    ...overrides,
  });
}

describe('evaluateTypeAConnectionWriteGate', () => {
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

  it('blocks none create', () => {
    expect(evaluate('none')).toEqual({
      canCreate: false,
      blockReason: 'membership_none',
      bypassesMembership: false,
    });
  });

  it('blocks guest create', () => {
    expect(
      evaluateTypeAConnectionWriteGate({
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
      evaluateTypeAConnectionWriteGate({
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
      evaluateTypeAConnectionWriteGate({
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
      evaluateTypeAConnectionWriteGate({
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
      evaluateTypeAConnectionWriteGate({
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

describe('canEditTypeAConnection', () => {
  it('allows owner to edit own connection', () => {
    expect(
      canEditTypeAConnection({
        currentUser: makeUser({ uid: 'user-1' }),
        activeSpace: makeSpace(),
        isContentArchived: false,
        connection: makeConnection({ createdBy: 'user-1' }),
      }),
    ).toBe(true);
  });

  it('blocks editing others connection for participants', () => {
    expect(
      canEditTypeAConnection({
        currentUser: makeUser({ uid: 'user-1' }),
        activeSpace: makeSpace(),
        isContentArchived: false,
        connection: makeConnection({ createdBy: 'user-2' }),
      }),
    ).toBe(false);
  });

  it('allows admin to edit others connection', () => {
    expect(
      canEditTypeAConnection({
        currentUser: makeUser({ isAdmin: true, communityId: 'comm-1' }),
        activeSpace: makeSpace({ communityId: 'comm-1' }),
        isContentArchived: false,
        connection: makeConnection({ createdBy: 'user-2' }),
      }),
    ).toBe(true);
  });

  it('blocks all edits when archived', () => {
    expect(
      canEditTypeAConnection({
        currentUser: makeUser({ isAdmin: true, communityId: 'comm-1' }),
        activeSpace: makeSpace({ communityId: 'comm-1' }),
        isContentArchived: true,
        connection: makeConnection({ createdBy: 'user-2' }),
      }),
    ).toBe(false);
  });
});
