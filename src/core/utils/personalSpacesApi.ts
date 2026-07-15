import { supabase, isSupabaseConfigured } from '../supabase';

/**
 * Phase 3: コミュニティ内個人スペースの表示・作成 API。
 *
 * 個人スペースは AccountScreen / MyLogs / My Hossii（Hossii 全体の個人領域）とは別物で、
 * 特定コミュニティの目的に沿って提供される実際の spaces（space_type='personal'）。
 * owner 本人・所属コミュニティ管理者・super_admin のみが閲覧でき、RLS で強制される。
 */

export type CommunityPersonalSpace = {
  communityId: string;
  communityName: string;
  membershipStatus: string;
  /** 未作成なら null */
  personalSpaceId: string | null;
  /** 未作成 / slug 欠損なら null（/s 導線を出さない） */
  personalSpaceUrl: string | null;
  personalSpaceStatus: string | null;
};

type Row = {
  community_id: string;
  community_name: string;
  membership_status: string;
  personal_space_id: string | null;
  personal_space_url: string | null;
  personal_space_status: string | null;
};

export function mapCommunityPersonalSpaceRow(row: Row): CommunityPersonalSpace {
  return {
    communityId: row.community_id,
    communityName: row.community_name,
    membershipStatus: row.membership_status,
    personalSpaceId: row.personal_space_id,
    personalSpaceUrl: row.personal_space_url,
    personalSpaceStatus: row.personal_space_status,
  };
}

/**
 * ログイン本人が active な各コミュニティと、そのコミュニティ内の自分の個人スペース有無を返す。
 * - SECURITY DEFINER RPC 経由。auth.uid() が正本で本人分のみ。
 * - ゲスト・未ログイン・未設定時は空配列。
 * @throws ログイン中に RPC が失敗した場合。
 */
export async function fetchMyCommunityPersonalSpaces(): Promise<CommunityPersonalSpace[]> {
  if (!isSupabaseConfigured) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];

  const { data, error } = await supabase.rpc('list_my_community_personal_spaces');
  if (error) {
    throw new Error(`[personalSpacesApi] fetchMyCommunityPersonalSpaces failed: ${error.message}`);
  }

  return ((data ?? []) as Row[]).map(mapCommunityPersonalSpaceRow);
}

export type EnsurePersonalSpaceResult =
  | { ok: true; spaceId: string; spaceUrl: string | null }
  | { ok: false; message: string; code?: string };

/**
 * 指定コミュニティ内の自分の個人スペースを（無ければ作成して）返す。
 * - SECURITY DEFINER RPC 経由（authenticated のみ）。auth.uid() が正本。
 * - active community member のみ成功。invited/suspended/removed/非member/guest は失敗。
 * - 冪等: 既存があれば同じスペースを返す。別コミュニティは別スペース。
 */
export async function ensureMyPersonalSpace(
  communityId: string,
): Promise<EnsurePersonalSpaceResult> {
  if (!isSupabaseConfigured || !communityId) {
    return { ok: false, message: 'Supabase is not configured' };
  }

  const { data, error } = await supabase.rpc('ensure_my_personal_space', {
    p_community_id: communityId,
  });
  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { space_id: string; space_url: string | null }
    | undefined;
  if (!row?.space_id) {
    return { ok: false, message: 'personal space not returned' };
  }
  return { ok: true, spaceId: row.space_id, spaceUrl: row.space_url ?? null };
}
