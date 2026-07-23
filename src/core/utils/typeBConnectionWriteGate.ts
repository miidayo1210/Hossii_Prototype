import type { AppUser } from '../contexts/AuthContext';
import type { Space } from '../types/space';
import { isViewingOwnPersonalSpace } from './personalSpaceShortcut';
import type { ActiveSpaceMembershipStatus } from './membershipJoinController';
import { canManageSpace } from './spaceAdminAccess';

export type TypeBConnectionWriteGateResult = {
  canCreate: boolean;
  blockReason:
    | 'archived'
    | 'guest'
    | 'membership_joining'
    | 'membership_none'
    | 'membership_error'
    | null;
  bypassesMembership: boolean;
};

export type TypeBConnectionWriteGateInput = {
  currentUser: AppUser | null | undefined;
  activeSpace: Space | null | undefined;
  isContentArchived: boolean;
  activeSpaceMembershipStatus: ActiveSpaceMembershipStatus;
};

function bypassesMembershipGate(
  currentUser: AppUser | null | undefined,
  activeSpace: Space | null | undefined,
): boolean {
  if (!currentUser || !activeSpace) return false;
  if (canManageSpace(currentUser, activeSpace)) return true;
  return isViewingOwnPersonalSpace({
    spaceType: activeSpace.spaceType,
    spaceOwnerUserId: activeSpace.ownerUserId,
    currentUserId: currentUser.uid,
  });
}

export function evaluateTypeBConnectionWriteGate(
  input: TypeBConnectionWriteGateInput,
): TypeBConnectionWriteGateResult {
  const { currentUser, activeSpace, isContentArchived, activeSpaceMembershipStatus } = input;

  if (isContentArchived) {
    return { canCreate: false, blockReason: 'archived', bypassesMembership: false };
  }

  if (!currentUser) {
    return { canCreate: false, blockReason: 'guest', bypassesMembership: false };
  }

  const bypassesMembership = bypassesMembershipGate(currentUser, activeSpace);
  if (bypassesMembership) {
    return { canCreate: true, blockReason: null, bypassesMembership: true };
  }

  switch (activeSpaceMembershipStatus) {
    case 'active':
      return { canCreate: true, blockReason: null, bypassesMembership: false };
    case 'idle':
    case 'joining':
      return {
        canCreate: false,
        blockReason: 'membership_joining',
        bypassesMembership: false,
      };
    case 'error':
      return { canCreate: false, blockReason: 'membership_error', bypassesMembership: false };
    case 'none':
    default:
      return { canCreate: false, blockReason: 'membership_none', bypassesMembership: false };
  }
}
