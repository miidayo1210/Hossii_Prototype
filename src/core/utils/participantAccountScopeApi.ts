import { supabase, isSupabaseConfigured } from '../supabase';
import type { MyCommunityMembership } from '../types/communityMembership';
import type { JoinedSpace } from './joinedSpacesApi';

/**
 * 参加IDアカウントの Account 所属表示用スコープ。
 * 正本: auth.uid() → get_my_issued_participant_scope() → 発行元 space / community
 * community_memberships / space_memberships 一覧は使わない（ニックネーム列のみ RPC 内で任意取得）。
 */

export type IssuedParticipantScopeOk = {
  ok: true;
  spaceId: string;
  spaceName: string | null;
  spaceUrl: string | null;
  isArchived: boolean;
  communityId: string;
  communityName: string;
  communitySlug: string | null;
  spaceNickname: string | null;
  /** space_memberships がある場合はその id。無い場合は表示用の安定キー */
  membershipId: string;
  joinedAt: string;
};

export type IssuedParticipantScopeError = {
  ok: false;
  reason:
    | 'not_configured'
    | 'not_authenticated'
    | 'not_found'
    | 'ambiguous'
    | 'space_missing'
    | 'community_missing'
    | 'query_failed';
};

export type IssuedParticipantScopeResult = IssuedParticipantScopeOk | IssuedParticipantScopeError;

/** get_my_issued_participant_scope RPC の 1 行（snake_case） */
export type IssuedParticipantScopeRpcRow = {
  space_id: string;
  space_name: string | null;
  space_url: string | null;
  is_archived: boolean | null;
  community_id: string;
  community_name: string;
  community_slug: string | null;
  space_nickname: string | null;
  membership_id: string | null;
  joined_at: string | null;
  issued_at: string | null;
};

/** テスト用: active 行の件数から結果理由を判定する純関数 */
export function classifyIssuedParticipantRows(count: number): 'ok' | 'not_found' | 'ambiguous' {
  if (count === 0) return 'not_found';
  if (count > 1) return 'ambiguous';
  return 'ok';
}

/** RPC エラーメッセージから ambiguous を判定 */
export function isAmbiguousIssuedParticipantScopeError(message: string | undefined | null): boolean {
  return typeof message === 'string' && message.includes('ambiguous_issued_participant_scope');
}

export function mapIssuedParticipantScopeRpcRow(
  row: IssuedParticipantScopeRpcRow,
): IssuedParticipantScopeOk {
  const spaceId = row.space_id;
  return {
    ok: true,
    spaceId,
    spaceName: row.space_name ?? null,
    spaceUrl: row.space_url,
    isArchived: row.is_archived === true,
    communityId: row.community_id,
    communityName: row.community_name,
    communitySlug: row.community_slug,
    spaceNickname: row.space_nickname ?? null,
    membershipId: row.membership_id ?? `participant-scope:${spaceId}`,
    joinedAt: row.joined_at ?? row.issued_at ?? new Date(0).toISOString(),
  };
}

export function toIssuedParticipantCommunityMembership(
  scope: IssuedParticipantScopeOk,
): MyCommunityMembership {
  return {
    communityId: scope.communityId,
    communityName: scope.communityName,
    communitySlug: scope.communitySlug ?? undefined,
    role: 'member',
    status: 'active',
    communityNickname: null,
  };
}

export function toIssuedParticipantJoinedSpace(scope: IssuedParticipantScopeOk): JoinedSpace {
  return {
    membershipId: scope.membershipId,
    spaceId: scope.spaceId,
    spaceNickname: scope.spaceNickname,
    joinedAt: scope.joinedAt,
    spaceName: scope.spaceName,
    spaceUrl: scope.spaceUrl,
    communityName: scope.communityName,
    communitySlug: scope.communitySlug,
    isArchived: scope.isArchived,
  };
}

/**
 * ログイン中参加IDの発行元 space / community を取得する。
 * - get_my_issued_participant_scope（SECURITY DEFINER）経由。communities 直 SELECT はしない。
 * - 失敗時に membership 一覧へ fallback しない（呼び出し側の責務）。
 * - active な participant 行が 0 件 / 2 件以上はエラー。
 */
export async function fetchIssuedParticipantAccountScope(): Promise<IssuedParticipantScopeResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'not_configured' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) {
    return { ok: false, reason: 'not_authenticated' };
  }

  const { data, error } = await supabase.rpc('get_my_issued_participant_scope');

  if (error) {
    if (isAmbiguousIssuedParticipantScopeError(error.message)) {
      console.error('[participantAccountScopeApi] ambiguous active participant rows');
      return { ok: false, reason: 'ambiguous' };
    }
    console.error('[participantAccountScopeApi] RPC failed:', error.message);
    return { ok: false, reason: 'query_failed' };
  }

  const rows = (data ?? []) as IssuedParticipantScopeRpcRow[];
  const classified = classifyIssuedParticipantRows(rows.length);
  if (classified === 'not_found') return { ok: false, reason: 'not_found' };
  if (classified === 'ambiguous') {
    // RPC 側でも弾くが、防御的にクライアントでも判定する
    console.error('[participantAccountScopeApi] ambiguous RPC rows', { count: rows.length });
    return { ok: false, reason: 'ambiguous' };
  }

  return mapIssuedParticipantScopeRpcRow(rows[0]!);
}
