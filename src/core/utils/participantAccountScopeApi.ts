import { supabase, isSupabaseConfigured } from '../supabase';
import type { MyCommunityMembership } from '../types/communityMembership';
import type { JoinedSpace } from './joinedSpacesApi';

/**
 * 参加IDアカウントの Account 所属表示用スコープ。
 * 正本: auth.uid() → space_participant_accounts (active) → space → community
 * community_memberships / space_memberships は使わない。
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
  reason: 'not_configured' | 'not_authenticated' | 'not_found' | 'ambiguous' | 'space_missing' | 'community_missing' | 'query_failed';
};

export type IssuedParticipantScopeResult = IssuedParticipantScopeOk | IssuedParticipantScopeError;

type ParticipantAccountRow = {
  space_id: string;
  status: string;
  issued_at: string | null;
};

type SpaceRow = {
  id: string;
  name: string;
  space_url: string | null;
  community_id: string | null;
  is_archived: boolean | null;
};

type CommunityRow = {
  id: string;
  name: string;
  slug: string | null;
};

type SpaceMembershipNickRow = {
  id: string;
  space_nickname: string | null;
  joined_at: string | null;
};

/** テスト用: active 行の件数から結果理由を判定する純関数 */
export function classifyIssuedParticipantRows(count: number): 'ok' | 'not_found' | 'ambiguous' {
  if (count === 0) return 'not_found';
  if (count > 1) return 'ambiguous';
  return 'ok';
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

  const { data: participantData, error: participantError } = await supabase
    .from('space_participant_accounts')
    .select('space_id, status, issued_at')
    .eq('auth_user_id', uid)
    .eq('status', 'active');

  if (participantError) {
    console.error('[participantAccountScopeApi] participant lookup failed:', participantError.message);
    return { ok: false, reason: 'query_failed' };
  }

  const rows = (participantData ?? []) as ParticipantAccountRow[];
  const classified = classifyIssuedParticipantRows(rows.length);
  if (classified === 'not_found') return { ok: false, reason: 'not_found' };
  if (classified === 'ambiguous') {
    console.error('[participantAccountScopeApi] ambiguous active participant rows', { count: rows.length });
    return { ok: false, reason: 'ambiguous' };
  }

  const participant = rows[0]!;
  const spaceId = participant.space_id;

  const { data: spaceData, error: spaceError } = await supabase
    .from('spaces')
    .select('id, name, space_url, community_id, is_archived')
    .eq('id', spaceId)
    .maybeSingle();

  if (spaceError) {
    console.error('[participantAccountScopeApi] space lookup failed:', spaceError.message);
    return { ok: false, reason: 'query_failed' };
  }
  if (!spaceData) {
    return { ok: false, reason: 'space_missing' };
  }

  const space = spaceData as SpaceRow;
  const communityId = space.community_id;
  if (!communityId) {
    return { ok: false, reason: 'community_missing' };
  }

  const { data: communityData, error: communityError } = await supabase
    .from('communities')
    .select('id, name, slug')
    .eq('id', communityId)
    .maybeSingle();

  if (communityError) {
    console.error('[participantAccountScopeApi] community lookup failed:', communityError.message);
    return { ok: false, reason: 'query_failed' };
  }
  if (!communityData) {
    return { ok: false, reason: 'community_missing' };
  }

  const community = communityData as CommunityRow;

  // ニックネーム表示用に、発行元 space の本人 membership があれば利用（一覧の正本にはしない）
  const { data: membershipData } = await supabase
    .from('space_memberships')
    .select('id, space_nickname, joined_at')
    .eq('space_id', spaceId)
    .eq('auth_user_id', uid)
    .maybeSingle();

  const membership = membershipData as SpaceMembershipNickRow | null;

  return {
    ok: true,
    spaceId,
    spaceName: space.name ?? null,
    spaceUrl: space.space_url,
    isArchived: space.is_archived === true,
    communityId,
    communityName: community.name,
    communitySlug: community.slug,
    spaceNickname: membership?.space_nickname ?? null,
    membershipId: membership?.id ?? `participant-scope:${spaceId}`,
    joinedAt: membership?.joined_at ?? participant.issued_at ?? new Date(0).toISOString(),
  };
}
