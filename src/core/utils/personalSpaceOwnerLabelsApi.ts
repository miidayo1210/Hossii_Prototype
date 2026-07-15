import { supabase, isSupabaseConfigured } from '../supabase';

export type OwnerLookupRow = {
  communityNickname: string | null;
  profileNickname: string | null;
  participantDisplayName: string | null;
  /** 管理上の補助表示用（主表示には使わない） */
  adminEmail: string | null;
};

export type PersonalSpaceOwnerDisplay = {
  displayName: string;
  supplementaryEmail: string | null;
};

/** 表示名に「さん」を付与（既に付いている・名前未設定はそのまま）。 */
export function formatOwnerDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '名前未設定') return '名前未設定';
  if (trimmed.endsWith('さん')) return trimmed;
  return `${trimmed}さん`;
}

/**
 * 個人スペース所有者の主表示名を解決する。
 * 優先: community_nickname → profile nickname → participant display → 名前未設定
 */
export function resolvePersonalSpaceOwnerDisplay(
  lookup: OwnerLookupRow | undefined,
): PersonalSpaceOwnerDisplay {
  const communityNickname = lookup?.communityNickname?.trim() || null;
  if (communityNickname) {
    return {
      displayName: formatOwnerDisplayName(communityNickname),
      supplementaryEmail: lookup?.adminEmail ?? null,
    };
  }

  const profileNickname = lookup?.profileNickname?.trim() || null;
  if (profileNickname) {
    return {
      displayName: formatOwnerDisplayName(profileNickname),
      supplementaryEmail: lookup?.adminEmail ?? null,
    };
  }

  const participant = lookup?.participantDisplayName?.trim() || null;
  if (participant) {
    return {
      displayName: formatOwnerDisplayName(participant),
      supplementaryEmail: lookup?.adminEmail ?? null,
    };
  }

  return {
    displayName: '名前未設定',
    supplementaryEmail: lookup?.adminEmail ?? null,
  };
}

type MembershipRow = {
  auth_user_id: string;
  community_nickname: string | null;
};

type UserProfileRow = {
  id: string;
  username: string;
};

type ParticipantRow = {
  auth_user_id: string;
  login_id: string;
};

type InvitationRow = {
  accepted_by: string | null;
  invitee_email: string;
};

/**
 * 個人スペース所有者の表示ラベル用データを取得する（コミュニティ管理者向け）。
 * community をまたがない。PII は画面表示のみ。
 */
export async function fetchPersonalSpaceOwnerLabels(
  communityId: string,
  ownerUserIds: string[],
): Promise<Map<string, OwnerLookupRow>> {
  const result = new Map<string, OwnerLookupRow>();
  if (!isSupabaseConfigured || !communityId) return result;

  const uniqueIds = [...new Set(ownerUserIds.filter(Boolean))];
  if (uniqueIds.length === 0) return result;

  for (const id of uniqueIds) {
    result.set(id, {
      communityNickname: null,
      profileNickname: null,
      participantDisplayName: null,
      adminEmail: null,
    });
  }

  const [membershipsRes, profilesRes, participantsRes, invitationsRes] = await Promise.all([
    supabase
      .from('community_memberships')
      .select('auth_user_id, community_nickname')
      .eq('community_id', communityId)
      .in('auth_user_id', uniqueIds),
    supabase.from('user_profiles').select('id, username').in('id', uniqueIds),
    supabase
      .from('space_participant_accounts')
      .select('auth_user_id, login_id, spaces!inner(community_id)')
      .eq('spaces.community_id', communityId)
      .in('auth_user_id', uniqueIds),
    supabase
      .from('community_invitations')
      .select('accepted_by, invitee_email')
      .eq('community_id', communityId)
      .eq('status', 'accepted')
      .in('accepted_by', uniqueIds),
  ]);

  if (membershipsRes.error) {
    console.error('[personalSpaceOwnerLabelsApi] memberships lookup failed');
  }
  if (profilesRes.error) {
    console.error('[personalSpaceOwnerLabelsApi] user_profiles lookup failed');
  }
  if (participantsRes.error) {
    console.error('[personalSpaceOwnerLabelsApi] participant lookup failed');
  }
  if (invitationsRes.error) {
    console.error('[personalSpaceOwnerLabelsApi] invitations lookup failed');
  }

  for (const row of (membershipsRes.data ?? []) as MembershipRow[]) {
    const existing = result.get(row.auth_user_id);
    if (existing) {
      existing.communityNickname = row.community_nickname;
    }
  }

  for (const row of (profilesRes.data ?? []) as UserProfileRow[]) {
    const existing = result.get(row.id);
    if (existing && row.username?.trim()) {
      existing.profileNickname = row.username.trim();
    }
  }

  for (const row of (participantsRes.data ?? []) as ParticipantRow[]) {
    const existing = result.get(row.auth_user_id);
    if (existing && !existing.participantDisplayName && row.login_id?.trim()) {
      existing.participantDisplayName = row.login_id.trim();
    }
  }

  for (const row of (invitationsRes.data ?? []) as InvitationRow[]) {
    if (!row.accepted_by) continue;
    const existing = result.get(row.accepted_by);
    if (existing && !existing.adminEmail) {
      existing.adminEmail = row.invitee_email;
    }
  }

  return result;
}
