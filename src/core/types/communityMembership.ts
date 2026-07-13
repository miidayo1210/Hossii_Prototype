// コミュニティ所属（community_memberships）の型。Phase 2 で追加。
// 認証アカウント（auth.users）とコミュニティ（communities）の正式な所属関係を表す。
// 権限判定の正本は当面 communities.admin_id / JWT super_admin。role は所属の記録。

export type CommunityMembershipRole = 'admin' | 'member';

export type CommunityMembershipStatus =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'removed';

/**
 * 本人の所属一覧の表示用モデル（list_my_community_memberships RPC の返却）。
 * community 名を含むが、admin_id / auth_user_id / PII は含めない。
 */
export interface MyCommunityMembership {
  communityId: string;
  communityName: string;
  communitySlug?: string;
  communityDescription?: string;
  role: CommunityMembershipRole;
  status: CommunityMembershipStatus;
  communityNickname: string | null;
}
