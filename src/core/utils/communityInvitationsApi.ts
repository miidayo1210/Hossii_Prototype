import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  CommunityMembershipRole,
  CommunityMembershipStatus,
} from '../types/communityMembership';

export type AdminCommunityMember = {
  membershipId: string;
  displayName: string;
  role: CommunityMembershipRole;
  status: CommunityMembershipStatus;
  communityNickname: string | null;
  joinedAt: string;
};

export type CommunityInvitation = {
  invitationId: string;
  inviteeEmail: string;
  role: CommunityMembershipRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export type AdminRpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

type AdminMemberRow = {
  membership_id: string;
  display_name: string;
  role: string;
  status: string;
  community_nickname: string | null;
  joined_at: string;
};

type InvitationRow = {
  invitation_id: string;
  invitee_email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

type CreateInviteRow = {
  invitation_id: string;
  invite_token: string;
  expires_at: string;
};

export async function fetchAdminCommunityMembers(
  communityId: string,
): Promise<AdminCommunityMember[]> {
  if (!isSupabaseConfigured || !communityId) return [];
  const { data, error } = await supabase.rpc('admin_list_community_members', {
    p_community_id: communityId,
  });
  if (error) throw new Error(`admin_list_community_members: ${error.message}`);
  return ((data ?? []) as AdminMemberRow[]).map((r) => ({
    membershipId: r.membership_id,
    displayName: r.display_name,
    role: r.role as CommunityMembershipRole,
    status: r.status as CommunityMembershipStatus,
    communityNickname: r.community_nickname,
    joinedAt: r.joined_at,
  }));
}

export async function adminSuspendCommunityMember(
  communityId: string,
  membershipId: string,
): Promise<AdminRpcResult<{ membershipId: string; status: CommunityMembershipStatus }>> {
  const { data, error } = await supabase.rpc('admin_suspend_community_member', {
    p_community_id: communityId,
    p_membership_id: membershipId,
  });
  if (error) return { ok: false, message: error.message, code: error.code };
  const row = (Array.isArray(data) ? data[0] : data) as { membership_id: string; status: string } | undefined;
  if (!row) return { ok: false, message: 'no data returned' };
  return { ok: true, data: { membershipId: row.membership_id, status: row.status as CommunityMembershipStatus } };
}

export async function adminReactivateCommunityMember(
  communityId: string,
  membershipId: string,
): Promise<AdminRpcResult<{ membershipId: string; status: CommunityMembershipStatus }>> {
  const { data, error } = await supabase.rpc('admin_reactivate_community_member', {
    p_community_id: communityId,
    p_membership_id: membershipId,
  });
  if (error) return { ok: false, message: error.message, code: error.code };
  const row = (Array.isArray(data) ? data[0] : data) as { membership_id: string; status: string } | undefined;
  if (!row) return { ok: false, message: 'no data returned' };
  return { ok: true, data: { membershipId: row.membership_id, status: row.status as CommunityMembershipStatus } };
}

export async function adminRemoveCommunityMember(
  communityId: string,
  membershipId: string,
): Promise<AdminRpcResult<{ membershipId: string; status: CommunityMembershipStatus }>> {
  const { data, error } = await supabase.rpc('admin_remove_community_member', {
    p_community_id: communityId,
    p_membership_id: membershipId,
  });
  if (error) return { ok: false, message: error.message, code: error.code };
  const row = (Array.isArray(data) ? data[0] : data) as { membership_id: string; status: string } | undefined;
  if (!row) return { ok: false, message: 'no data returned' };
  return { ok: true, data: { membershipId: row.membership_id, status: row.status as CommunityMembershipStatus } };
}

export async function createCommunityInvitation(
  communityId: string,
  inviteeEmail: string,
  role: CommunityMembershipRole = 'member',
): Promise<AdminRpcResult<{ invitationId: string; inviteToken: string; expiresAt: string }>> {
  const { data, error } = await supabase.rpc('admin_create_community_invitation', {
    p_community_id: communityId,
    p_invitee_email: inviteeEmail,
    p_role: role,
    p_expires_in_hours: 168,
  });
  if (error) return { ok: false, message: error.message, code: error.code };
  const row = (Array.isArray(data) ? data[0] : data) as CreateInviteRow | undefined;
  if (!row?.invite_token) return { ok: false, message: 'no token returned' };
  return {
    ok: true,
    data: {
      invitationId: row.invitation_id,
      inviteToken: row.invite_token,
      expiresAt: row.expires_at,
    },
  };
}

export async function fetchCommunityInvitations(
  communityId: string,
): Promise<CommunityInvitation[]> {
  if (!isSupabaseConfigured || !communityId) return [];
  const { data, error } = await supabase.rpc('admin_list_community_invitations', {
    p_community_id: communityId,
  });
  if (error) throw new Error(`admin_list_community_invitations: ${error.message}`);
  return ((data ?? []) as InvitationRow[]).map((r) => ({
    invitationId: r.invitation_id,
    inviteeEmail: r.invitee_email,
    role: r.role as CommunityMembershipRole,
    status: r.status as CommunityInvitation['status'],
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
    revokedAt: r.revoked_at,
  }));
}

export async function revokeCommunityInvitation(
  communityId: string,
  invitationId: string,
): Promise<AdminRpcResult<{ invitationId: string; status: string }>> {
  const { data, error } = await supabase.rpc('admin_revoke_community_invitation', {
    p_community_id: communityId,
    p_invitation_id: invitationId,
  });
  if (error) return { ok: false, message: error.message, code: error.code };
  const row = (Array.isArray(data) ? data[0] : data) as { invitation_id: string; status: string } | undefined;
  if (!row) return { ok: false, message: 'no data returned' };
  return { ok: true, data: { invitationId: row.invitation_id, status: row.status } };
}

export async function acceptCommunityInvitation(
  inviteToken: string,
): Promise<AdminRpcResult<{ communityId: string; communityName: string; role: CommunityMembershipRole; status: CommunityMembershipStatus }>> {
  const { data, error } = await supabase.rpc('accept_community_invitation', {
    p_invite_token: inviteToken,
  });
  if (error) return { ok: false, message: error.message, code: error.code };
  const row = (Array.isArray(data) ? data[0] : data) as {
    community_id: string;
    community_name: string;
    role: string;
    status: string;
  } | undefined;
  if (!row) return { ok: false, message: 'no data returned' };
  return {
    ok: true,
    data: {
      communityId: row.community_id,
      communityName: row.community_name,
      role: row.role as CommunityMembershipRole,
      status: row.status as CommunityMembershipStatus,
    },
  };
}

export async function updateMyCommunityNickname(
  communityId: string,
  nickname: string,
): Promise<AdminRpcResult<string | null>> {
  const { data, error } = await supabase.rpc('update_my_community_nickname', {
    p_community_id: communityId,
    p_community_nickname: nickname,
  });
  if (error) return { ok: false, message: error.message, code: error.code };
  return { ok: true, data: (data as string | null) ?? null };
}

/** 招待 URL を組み立てる（raw token は呼び出し元で一度だけ保持） */
export function buildInviteUrl(inviteToken: string, baseUrl?: string): string {
  if (baseUrl) {
    return `${baseUrl}#community-invite/${encodeURIComponent(inviteToken)}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}#community-invite/${encodeURIComponent(inviteToken)}`;
  }
  return `https://app.local/#community-invite/${encodeURIComponent(inviteToken)}`;
}
