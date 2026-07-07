import { supabase, isSupabaseConfigured } from '../supabase';

const STORAGE_KEY = 'hossii.myHossiiSpacePreferences';

type PreferenceMap = Record<string, Record<string, boolean>>;

function loadMockPreferences(): PreferenceMap {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PreferenceMap;
  } catch {
    return {};
  }
}

function saveMockPreferences(map: PreferenceMap): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * 本人のスペース別登場設定を取得する。
 * 行が存在しない場合は true（初期 ON）を返す。
 */
export async function fetchMyHossiiSpacePreference(
  userId: string,
  spaceId: string,
): Promise<boolean> {
  if (!spaceId || !userId) return true;

  if (!isSupabaseConfigured) {
    const map = loadMockPreferences();
    const value = map[userId]?.[spaceId];
    return value ?? true;
  }

  const { data, error } = await supabase
    .from('space_my_hossii_preferences')
    .select('is_visible')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[myHossiiSpacePreferencesApi] fetch error:', error.message);
    throw error;
  }

  if (!data) return true;
  return (data as { is_visible: boolean }).is_visible;
}

export async function upsertMyHossiiSpacePreference(
  userId: string,
  spaceId: string,
  isVisible: boolean,
): Promise<void> {
  if (!spaceId || !userId) return;

  if (!isSupabaseConfigured) {
    const map = loadMockPreferences();
    if (!map[userId]) map[userId] = {};
    map[userId][spaceId] = isVisible;
    saveMockPreferences(map);
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('space_my_hossii_preferences')
    .upsert(
      {
        space_id: spaceId,
        user_id: userId,
        is_visible: isVisible,
        updated_at: now,
      },
      { onConflict: 'space_id,user_id' },
    );

  if (error) {
    console.error('[myHossiiSpacePreferencesApi] upsert error:', error.message);
    throw error;
  }
}

/** @internal テスト用 */
export { STORAGE_KEY as MY_HOSSII_SPACE_PREFERENCES_STORAGE_KEY };
