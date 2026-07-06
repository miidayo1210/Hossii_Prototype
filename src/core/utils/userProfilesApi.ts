import { supabase, isSupabaseConfigured } from '../supabase';
import { isValidHossiiPresetKey } from '../assets/hossiiPresets';

export type MyHossiiSettings = {
  sourceType: 'preset' | null;
  presetKey: string | null;
  updatedAt: string | null;
};

export type UserProfileData = {
  id: string;
  username: string;
  birthdate?: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  createdAt: string;
  updatedAt: string;
  myHossii: MyHossiiSettings;
};

type UserProfileRow = {
  id: string;
  username: string;
  birthdate: string | null;
  gender: string | null;
  created_at: string;
  updated_at: string;
  hossii_source_type?: string | null;
  hossii_preset_key?: string | null;
  hossii_updated_at?: string | null;
};

const USER_PROFILE_SELECT =
  'id, username, birthdate, gender, created_at, updated_at, hossii_source_type, hossii_preset_key, hossii_updated_at';

const MY_HOSSII_STORAGE_KEY = 'hossii.myHossiiSettings';

const EMPTY_MY_HOSSII: MyHossiiSettings = {
  sourceType: null,
  presetKey: null,
  updatedAt: null,
};

function parseMyHossiiFromRow(row: Pick<UserProfileRow, 'hossii_source_type' | 'hossii_preset_key' | 'hossii_updated_at'>): MyHossiiSettings {
  if (row.hossii_source_type !== 'preset' || !row.hossii_preset_key) {
    return EMPTY_MY_HOSSII;
  }
  if (!isValidHossiiPresetKey(row.hossii_preset_key)) {
    return EMPTY_MY_HOSSII;
  }
  return {
    sourceType: 'preset',
    presetKey: row.hossii_preset_key,
    updatedAt: row.hossii_updated_at ?? null,
  };
}

function rowToUserProfile(row: UserProfileRow): UserProfileData {
  return {
    id: row.id,
    username: row.username,
    birthdate: row.birthdate,
    gender: row.gender as UserProfileData['gender'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myHossii: parseMyHossiiFromRow(row),
  };
}

function loadMockMyHossii(userId: string): MyHossiiSettings {
  if (typeof localStorage === 'undefined') return EMPTY_MY_HOSSII;
  const raw = localStorage.getItem(MY_HOSSII_STORAGE_KEY);
  if (!raw) return EMPTY_MY_HOSSII;
  try {
    const map = JSON.parse(raw) as Record<string, MyHossiiSettings>;
    return map[userId] ?? EMPTY_MY_HOSSII;
  } catch {
    return EMPTY_MY_HOSSII;
  }
}

function saveMockMyHossii(userId: string, settings: MyHossiiSettings): void {
  if (typeof localStorage === 'undefined') return;
  const raw = localStorage.getItem(MY_HOSSII_STORAGE_KEY);
  let map: Record<string, MyHossiiSettings> = {};
  if (raw) {
    try {
      map = JSON.parse(raw) as Record<string, MyHossiiSettings>;
    } catch {
      map = {};
    }
  }
  map[userId] = settings;
  localStorage.setItem(MY_HOSSII_STORAGE_KEY, JSON.stringify(map));
}

function isDuplicateKeyError(error: { code?: string }): boolean {
  return error.code === '23505';
}

async function resolveInitialUsername(userId: string): Promise<string> {
  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('default_nickname')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[userProfilesApi] resolveInitialUsername: profiles lookup failed, using fallback', error.message);
  }

  const nickname = (profileRow as { default_nickname?: string } | null)?.default_nickname?.trim();
  return nickname || 'ユーザー';
}

/**
 * user_profiles 行が存在しない場合のみ、必須列だけで INSERT する。
 * 既存行は更新しない。
 */
async function insertUserProfileIfMissing(userId: string, username: string): Promise<void> {
  const { error } = await supabase.from('user_profiles').insert({
    id: userId,
    username,
  });

  if (!error) return;

  if (isDuplicateKeyError(error)) {
    return;
  }

  console.error('[userProfilesApi] insertUserProfileIfMissing error:', error.message);
  throw error;
}

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

/**
 * ログインユーザーに user_profiles 行が無い場合に最小限の行を作成する。
 * ログインID・メールアドレスは username に使わない。
 */
export async function ensureUserProfileExists(userId: string): Promise<UserProfileData> {
  const existing = await fetchUserProfile(userId);
  if (existing) return existing;

  if (!isSupabaseConfigured) {
    return {
      id: userId,
      username: 'ユーザー',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      myHossii: loadMockMyHossii(userId),
    };
  }

  const username = await resolveInitialUsername(userId);
  await insertUserProfileIfMissing(userId, username);

  const created = await fetchUserProfile(userId);
  if (!created) {
    throw new Error('ユーザープロフィールの作成に失敗しました');
  }
  return created;
}

export async function fetchUserProfile(id: string): Promise<UserProfileData | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select(USER_PROFILE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[userProfilesApi] fetchUserProfile error:', error.message);
    throw error;
  }

  if (!data) return null;

  return rowToUserProfile(data as UserProfileRow);
}

export async function fetchMyHossiiSettings(userId: string): Promise<MyHossiiSettings> {
  if (!isSupabaseConfigured) {
    return loadMockMyHossii(userId);
  }

  const profile = await fetchUserProfile(userId);
  return profile?.myHossii ?? EMPTY_MY_HOSSII;
}

export async function saveMyHossiiPreset(userId: string, presetKey: string): Promise<MyHossiiSettings> {
  if (!isValidHossiiPresetKey(presetKey)) {
    throw new Error('無効なプリセットです');
  }

  const now = new Date().toISOString();
  const saved: MyHossiiSettings = {
    sourceType: 'preset',
    presetKey,
    updatedAt: now,
  };

  if (!isSupabaseConfigured) {
    saveMockMyHossii(userId, saved);
    return saved;
  }

  await ensureUserProfileExists(userId);

  const { error } = await supabase
    .from('user_profiles')
    .update({
      hossii_source_type: 'preset',
      hossii_preset_key: presetKey,
      hossii_updated_at: now,
      updated_at: now,
    })
    .eq('id', userId);

  if (error) {
    console.error('[userProfilesApi] saveMyHossiiPreset error:', error.message);
    throw error;
  }

  return saved;
}

/** @internal テスト用 */
export function parseMyHossiiRowForTest(
  row: Pick<UserProfileRow, 'hossii_source_type' | 'hossii_preset_key' | 'hossii_updated_at'>,
): MyHossiiSettings {
  return parseMyHossiiFromRow(row);
}

/** @internal テスト用 */
export function isDuplicateKeyErrorForTest(error: { code?: string }): boolean {
  return isDuplicateKeyError(error);
}

/** @internal テスト用 */
export { MY_HOSSII_STORAGE_KEY };
