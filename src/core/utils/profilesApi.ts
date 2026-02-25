import { supabase, isSupabaseConfigured } from '../supabase';
import type { UserProfile, SpaceNicknames } from '../types/profile';

type ProfileRow = {
  id: string;
  default_nickname: string;
  created_at: string;
};

type SpaceNicknameRow = {
  profile_id: string;
  space_id: string;
  nickname: string;
};

export async function upsertProfile(profile: UserProfile): Promise<void> {
  if (!isSupabaseConfigured) return;

  const row: ProfileRow = {
    id: profile.id,
    default_nickname: profile.defaultNickname,
    created_at: profile.createdAt.toISOString(),
  };

  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[profilesApi] upsertProfile error:', error.message);
  }
}

export async function upsertSpaceNickname(
  profileId: string,
  spaceId: string,
  nickname: string
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const row: SpaceNicknameRow = {
    profile_id: profileId,
    space_id: spaceId,
    nickname,
  };

  const { error } = await supabase
    .from('space_nicknames')
    .upsert(row, { onConflict: 'profile_id,space_id' });
  if (error) {
    console.error('[profilesApi] upsertSpaceNickname error:', error.message);
  }
}

export async function fetchSpaceNicknames(profileId: string): Promise<SpaceNicknames> {
  if (!isSupabaseConfigured) return {};

  const { data, error } = await supabase
    .from('space_nicknames')
    .select('space_id, nickname')
    .eq('profile_id', profileId);

  if (error) {
    console.error('[profilesApi] fetchSpaceNicknames error:', error.message);
    return {};
  }

  return (data as Pick<SpaceNicknameRow, 'space_id' | 'nickname'>[]).reduce<SpaceNicknames>(
    (acc, row) => {
      acc[row.space_id] = row.nickname;
      return acc;
    },
    {}
  );
}
