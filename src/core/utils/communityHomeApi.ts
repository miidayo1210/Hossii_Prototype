import { supabase, isSupabaseConfigured } from '../supabase';
import { fetchSpaceArchiveFlags } from './spaceArchiveApi';
import type { CommunityMembershipRole, CommunityMembershipStatus } from '../types/communityMembership';

export type CommunityHomeData = {
  communityId: string;
  communityName: string;
  communitySlug: string | null;
  communityDescription: string | null;
  myRole: CommunityMembershipRole;
  myStatus: CommunityMembershipStatus;
  myCommunityNickname: string | null;
  isCommunityAdmin: boolean;
  canViewPrivate: boolean;
  personalSpaceId: string | null;
  personalSpaceUrl: string | null;
};

export type CommunitySharedSpace = {
  spaceId: string;
  spaceName: string;
  spaceUrl: string;
  accessMode: 'public' | 'invite_only';
  canEnter: boolean;
  isArchived: boolean;
};

type HomeRow = {
  community_id: string;
  community_name: string;
  community_slug: string | null;
  community_description: string | null;
  my_role: string;
  my_status: string;
  my_community_nickname: string | null;
  is_community_admin: boolean;
  can_view_private: boolean;
  personal_space_id: string | null;
  personal_space_url: string | null;
};

type SharedSpaceRow = {
  space_id: string;
  space_name: string;
  space_url: string;
  access_mode: string;
  can_enter: boolean;
};

export async function fetchCommunityHome(
  communityId: string,
): Promise<CommunityHomeData | null> {
  if (!isSupabaseConfigured || !communityId) return null;
  const { data, error } = await supabase.rpc('fetch_community_home', {
    p_community_id: communityId,
  });
  if (error) throw new Error(`fetch_community_home: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as HomeRow | undefined;
  if (!row) return null;
  return {
    communityId: row.community_id,
    communityName: row.community_name,
    communitySlug: row.community_slug,
    communityDescription: row.community_description,
    myRole: row.my_role as CommunityMembershipRole,
    myStatus: row.my_status as CommunityMembershipStatus,
    myCommunityNickname: row.my_community_nickname,
    isCommunityAdmin: row.is_community_admin,
    canViewPrivate: row.can_view_private,
    personalSpaceId: row.personal_space_id,
    personalSpaceUrl: row.personal_space_url,
  };
}

export async function fetchCommunitySharedSpaces(
  communityId: string,
): Promise<CommunitySharedSpace[]> {
  if (!isSupabaseConfigured || !communityId) return [];
  const { data, error } = await supabase.rpc('list_community_shared_spaces', {
    p_community_id: communityId,
  });
  if (error) throw new Error(`list_community_shared_spaces: ${error.message}`);
  const spaces = ((data ?? []) as SharedSpaceRow[]).map((r) => ({
    spaceId: r.space_id,
    spaceName: r.space_name,
    spaceUrl: r.space_url,
    accessMode: (r.access_mode === 'invite_only' ? 'invite_only' : 'public') as 'public' | 'invite_only',
    canEnter: r.can_enter,
    isArchived: false,
  }));

  if (spaces.length === 0) return spaces;

  const flags = await fetchSpaceArchiveFlags(spaces.map((s) => s.spaceId));
  return spaces.map((s) => ({
    ...s,
    isArchived: flags.get(s.spaceId) ?? false,
  }));
}
