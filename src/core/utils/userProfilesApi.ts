import { supabase, isSupabaseConfigured } from '../supabase';

export type UserProfileData = {
  id: string;
  username: string;
  birthdate?: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  createdAt: string;
  updatedAt: string;
};

type UserProfileRow = {
  id: string;
  username: string;
  birthdate: string | null;
  gender: string | null;
  created_at: string;
  updated_at: string;
};

export async function upsertUserProfile(
  id: string,
  username: string,
  birthdate?: string | null,
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const row: UserProfileRow = {
    id,
    username,
    birthdate: birthdate ?? null,
    gender: gender ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[userProfilesApi] upsertUserProfile error:', error.message);
    throw error;
  }
}

export async function fetchUserProfile(id: string): Promise<UserProfileData | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, birthdate, gender, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[userProfilesApi] fetchUserProfile error:', error.message);
    return null;
  }

  if (!data) return null;

  const row = data as UserProfileRow;
  return {
    id: row.id,
    username: row.username,
    birthdate: row.birthdate,
    gender: row.gender as UserProfileData['gender'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
