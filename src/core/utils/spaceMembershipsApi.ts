import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  SpaceMembership,
  SpaceMembershipRole,
  SpaceMembershipStatus,
} from '../types/spaceMembership';

// DB (snake_case) 行。RLS により本人分（＋管理者は当該スペース分）のみ返る。
type SpaceMembershipRow = {
  id: string;
  space_id: string;
  auth_user_id: string;
  role: string;
  status: string;
  space_nickname: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
};

export function mapSpaceMembershipRow(row: SpaceMembershipRow): SpaceMembership {
  return {
    id: row.id,
    spaceId: row.space_id,
    authUserId: row.auth_user_id,
    role: row.role as SpaceMembershipRole,
    status: row.status as SpaceMembershipStatus,
    spaceNickname: row.space_nickname,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * ログイン中のユーザーを指定スペースの member として登録する。
 *
 * - 本人性は RPC 内の auth.uid() が正本（auth_user_id は引数に取らない＝なりすまし不可）。
 * - role は 'member' 固定・status は 'active' 固定（自己昇格不可）。
 * - 冪等: 同一 (space_id, auth_user_id) の再訪問では重複を作らず既存 role/status を変更しない。
 * - ゲスト（未ログイン）は membership を作らない。anon には RPC の EXECUTE 権限が無いため、
 *   セッションが無い場合はクエリを実行せず null を返す。
 *
 * @returns 作成/既存の membership。未設定・未ログイン時は null。
 * @throws ログイン中に RPC が失敗した場合。
 */
export async function joinSpaceAsMember(
  spaceId: string,
  nickname?: string | null,
): Promise<SpaceMembership | null> {
  if (!isSupabaseConfigured || !spaceId) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return null;
  }

  const { data, error } = await supabase.rpc('join_space_as_member', {
    p_space_id: spaceId,
    p_space_nickname: nickname ?? null,
  });

  if (error) {
    throw new Error(`[spaceMembershipsApi] joinSpaceAsMember failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as SpaceMembershipRow | undefined;
  return row ? mapSpaceMembershipRow(row) : null;
}

/**
 * ログイン中ユーザー本人の membership 一覧を取得する（全スペース横断）。
 * RLS により本人分のみ返る。未ログイン・未設定時は空配列。
 */
export async function fetchMySpaceMemberships(): Promise<SpaceMembership[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return [];
  }

  const { data, error } = await supabase
    .from('space_memberships')
    .select('*')
    .order('joined_at', { ascending: false });

  if (error) {
    throw new Error(`[spaceMembershipsApi] fetchMySpaceMemberships failed: ${error.message}`);
  }

  return ((data ?? []) as SpaceMembershipRow[]).map(mapSpaceMembershipRow);
}

/**
 * ログイン中ユーザー本人の、指定スペースにおける membership を 1 件取得する。
 * 未参加・未ログイン・未設定時は null。
 */
export async function fetchMyMembershipForSpace(
  spaceId: string,
): Promise<SpaceMembership | null> {
  if (!isSupabaseConfigured || !spaceId) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return null;
  }

  const { data, error } = await supabase
    .from('space_memberships')
    .select('*')
    .eq('space_id', spaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`[spaceMembershipsApi] fetchMyMembershipForSpace failed: ${error.message}`);
  }

  return data ? mapSpaceMembershipRow(data as SpaceMembershipRow) : null;
}
