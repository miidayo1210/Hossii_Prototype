// スペース所属（space_memberships）の型。Phase 2A で追加。
// 認証アカウント（auth.users）と共有スペースの正式な所属関係を表す。
// ゲスト端末 profile は membership に含めない（ログインアカウントのみ）。

export type SpaceMembershipRole = 'owner' | 'admin' | 'member';

export type SpaceMembershipStatus =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'removed';

export interface SpaceMembership {
  id: string;
  spaceId: string;
  authUserId: string;
  role: SpaceMembershipRole;
  status: SpaceMembershipStatus;
  spaceNickname: string | null;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}
