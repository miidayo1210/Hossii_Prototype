import { supabase, isSupabaseConfigured } from '../supabase';

export type OwnerLookupRow = {
  communityNickname: string | null;
  defaultNickname: string | null;
  email: string | null;
};

export type PersonalSpaceOwnerLabel = {
  primary: string;
  secondary: string | null;
};

export function shortOwnerUid(ownerUserId: string): string {
  return `${ownerUserId.slice(0, 8)}…`;
}

/** 109 / 113: community_nickname → default_nickname → メールローカル部 → UID 短縮 */
export function resolvePersonalSpaceOwnerLabel(
  ownerUserId: string | undefined,
  lookup: OwnerLookupRow | undefined,
): PersonalSpaceOwnerLabel {
  if (!ownerUserId) {
    return { primary: '不明', secondary: null };
  }

  const communityNickname = lookup?.communityNickname?.trim() || null;
  const defaultNickname = lookup?.defaultNickname?.trim() || null;
  const email = lookup?.email?.trim().toLowerCase() || null;
  const emailLocal = email?.includes('@') ? email.split('@')[0] : null;

  const primary =
    communityNickname ||
    defaultNickname ||
    emailLocal ||
    shortOwnerUid(ownerUserId);

  return {
    primary,
    secondary: email,
  };
}

type MembershipRow = {
  auth_user_id: string;
  community_nickname: string | null;
};

type ProfileRow = {
  id: string;
  default_nickname: string | null;
};

type InvitationRow = {
  accepted_by: string | null;
  invitee_email: string;
};

/**
 * 個人スペース所有者の表示ラベル用データを取得する（コミュニティ管理者向け）。
 * PII は画面表示のみ。エラーログに UID を出さない。
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
      defaultNickname: null,
      email: null,
    });
  }

  const [membershipsRes, profilesRes, invitationsRes] = await Promise.all([
    supabase
      .from('community_memberships')
      .select('auth_user_id, community_nickname')
      .eq('community_id', communityId)
      .in('auth_user_id', uniqueIds),
    supabase
      .from('profiles')
      .select('id, default_nickname')
      .in('id', uniqueIds),
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
    console.error('[personalSpaceOwnerLabelsApi] profiles lookup failed');
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

  for (const row of (profilesRes.data ?? []) as ProfileRow[]) {
    const existing = result.get(row.id);
    if (existing) {
      existing.defaultNickname = row.default_nickname;
    }
  }

  for (const row of (invitationsRes.data ?? []) as InvitationRow[]) {
    if (!row.accepted_by) continue;
    const existing = result.get(row.accepted_by);
    if (existing && !existing.email) {
      existing.email = row.invitee_email;
    }
  }

  return result;
}
