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
 * 未ログイン・未設定時は空配列。
 *
 * 本人性は auth.uid()（＝session.user.id）を正本とし、明示的に auth_user_id で
 * 絞り込む。space_memberships の SELECT RLS は「本人分」に加えてスペース管理者・
 * super_admin へ当該スペースの他メンバー行も見せるため、RLS だけに依存すると
 * 管理者では他人の membership まで返ってしまう。本関数は「本人の所属一覧」を返す
 * 契約なので、DB 側 RLS に加えクエリでも本人分へ限定する（UI 表示だけに依存しない）。
 */
export async function fetchMySpaceMemberships(): Promise<SpaceMembership[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) {
    return [];
  }

  const { data, error } = await supabase
    .from('space_memberships')
    .select('*')
    .eq('auth_user_id', uid)
    .order('joined_at', { ascending: false });

  if (error) {
    throw new Error(`[spaceMembershipsApi] fetchMySpaceMemberships failed: ${error.message}`);
  }

  return ((data ?? []) as SpaceMembershipRow[]).map(mapSpaceMembershipRow);
}

export type UpdateSpaceNicknameResult =
  | { ok: true; nickname: string | null }
  | { ok: false; message: string; code?: string };

/**
 * ログイン本人の space_memberships.space_nickname を安全に変更する（Phase 2F）。
 *
 * - SECURITY DEFINER RPC 経由（authenticated のみ EXECUTE 可）。auth.uid() が正本で、
 *   引数に auth_user_id を渡さない。RPC は本人の membership のみ・space_nickname だけを更新する。
 * - 正規化（trim / 空→NULL / 長さ / 制御文字）は RPC 内で行われ、確定後の値を返す。
 * - session なし・未設定時は安全に失敗する（例外を投げず ok:false）。
 */
export async function updateMySpaceNickname(
  spaceId: string,
  nickname: string,
): Promise<UpdateSpaceNicknameResult> {
  if (!isSupabaseConfigured || !spaceId) {
    return { ok: false, message: 'Supabase is not configured' };
  }

  const { data, error } = await supabase.rpc('update_my_space_nickname', {
    p_space_id: spaceId,
    p_space_nickname: nickname,
  });

  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  return { ok: true, nickname: (data as string | null) ?? null };
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
