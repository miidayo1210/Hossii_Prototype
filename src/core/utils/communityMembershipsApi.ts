import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  MyCommunityMembership,
  CommunityMembershipRole,
  CommunityMembershipStatus,
} from '../types/communityMembership';

// list_my_community_memberships RPC の 1 行（snake_case）。
type MyCommunityMembershipRow = {
  community_id: string;
  community_name: string;
  role: string;
  status: string;
};

export function mapMyCommunityMembershipRow(
  row: MyCommunityMembershipRow,
): MyCommunityMembership {
  return {
    communityId: row.community_id,
    communityName: row.community_name,
    role: row.role as CommunityMembershipRole,
    status: row.status as CommunityMembershipStatus,
  };
}

/**
 * ログイン本人のコミュニティ所属一覧を取得する（Phase 2）。
 *
 * - SECURITY DEFINER RPC 経由。auth.uid() を正本に本人の行だけを返す。
 * - communities は public read ではないため、community 名はこの RPC 経由で安全に得る。
 * - anon（ゲスト）・未ログイン・未設定時は空配列（RPC の EXECUTE 権限が無いため
 *   セッションが無ければクエリを実行しない）。
 * @throws ログイン中に RPC が失敗した場合。
 */
export async function fetchMyCommunityMemberships(): Promise<MyCommunityMembership[]> {
  if (!isSupabaseConfigured) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];

  const { data, error } = await supabase.rpc('list_my_community_memberships');
  if (error) {
    throw new Error(`[communityMembershipsApi] fetchMyCommunityMemberships failed: ${error.message}`);
  }

  return ((data ?? []) as MyCommunityMembershipRow[]).map(mapMyCommunityMembershipRow);
}

export type AddCommunityMemberResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

/**
 * コミュニティ管理者が個人をメンバーとして追加する（Phase 2）。
 *
 * - SECURITY DEFINER RPC。呼び出し者は当該コミュニティ管理者 / super_admin のみ（RPC 内で検証）。
 * - 初版は追加時点で status='active'。role は 'member' 既定。
 * - 冪等: 既存メンバーは role/status を維持する。
 */
export async function addCommunityMember(
  communityId: string,
  authUserId: string,
  role: CommunityMembershipRole = 'member',
): Promise<AddCommunityMemberResult> {
  if (!isSupabaseConfigured || !communityId || !authUserId) {
    return { ok: false, message: 'Supabase is not configured' };
  }

  const { error } = await supabase.rpc('admin_add_community_member', {
    p_community_id: communityId,
    p_auth_user_id: authUserId,
    p_role: role,
  });

  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  return { ok: true };
}
