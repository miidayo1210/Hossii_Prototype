import type { AppUser } from '../contexts/AuthContext';
import type { Space } from '../types/space';
import type { SpaceMembership } from '../types/spaceMembership';

/**
 * 現在のスペースを管理できるか（108 Phase 1.5C）。
 * super_admin、または当該スペースの community 管理者のみ true。
 */
export function canManageSpace(
  user: AppUser | null | undefined,
  space: Space | null | undefined,
): boolean {
  if (!user || !space) return false;
  if (user.isSuperAdmin === true) return true;
  if (!user.isAdmin) return false;
  if (!user.communityId || !space.communityId) return false;
  return user.communityId === space.communityId;
}

/** active な space_memberships の admin / owner。 */
export function isActiveSpaceMembershipAdmin(
  membership: SpaceMembership | null | undefined,
): boolean {
  if (!membership || membership.status !== 'active') return false;
  return membership.role === 'admin' || membership.role === 'owner';
}

/**
 * スペースアーカイブ ON/OFF を変更できるか（112 UI）。
 * super_admin / community 管理者 / 当該 space の admin|owner（DB の can_manage_space_archive と同等の client 判定）。
 */
export function canManageSpaceArchive(
  user: AppUser | null | undefined,
  space: Space | null | undefined,
  spaceMembership: SpaceMembership | null | undefined,
): boolean {
  if (canManageSpace(user, space)) return true;
  return isActiveSpaceMembershipAdmin(spaceMembership);
}
