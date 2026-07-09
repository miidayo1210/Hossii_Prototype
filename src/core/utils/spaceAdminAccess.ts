import type { AppUser } from '../contexts/AuthContext';
import type { Space } from '../types/space';

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
