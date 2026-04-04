import { supabase, isSupabaseConfigured } from '../supabase';

// ============================================================
// Feature Flag キーの定義
// 新しいフラグを追加する時はここに追加する
// ============================================================
export type FeatureFlagKey =
  | 'comments_thumbnail'
  | 'likes_enabled'
  | 'random_recall_enabled'
  | 'public_board_mode'
  | 'zine_export_enabled'
  | 'bubble_shapes_extended';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

// グローバル Kill Switch: VITE_FEATURE_FLAGS_DISABLED=true で全フラグを false にする
function isKillSwitchEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_FLAGS_DISABLED === 'true';
}

// ============================================================
// DB 行型
// ============================================================
type FeatureFlagRow = {
  key: string;
  default_enabled: boolean;
};

type SpaceFeatureFlagRow = {
  flag_key: string;
  enabled: boolean;
};

// ============================================================
// localStorage フォールバック（Supabase 未設定時用）
// ============================================================

function localStorageKey(spaceId: string): string {
  return `feature_flags_overrides_${spaceId}`;
}

function loadLocalOverrides(spaceId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(localStorageKey(spaceId));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveLocalOverride(spaceId: string, flagKey: string, enabled: boolean): void {
  const overrides = loadLocalOverrides(spaceId);
  overrides[flagKey] = enabled;
  localStorage.setItem(localStorageKey(spaceId), JSON.stringify(overrides));
}

function removeLocalOverride(spaceId: string, flagKey: string): void {
  const overrides = loadLocalOverrides(spaceId);
  delete overrides[flagKey];
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(localStorageKey(spaceId));
  } else {
    localStorage.setItem(localStorageKey(spaceId), JSON.stringify(overrides));
  }
}

// ============================================================
// getFeatureFlagsForSpace
// スペース単位のフラグを取得して、default + override をマージして返す
//
// 優先順位: Supabase override > default
// （Supabase 取得失敗時のみ localStorage をフォールバックとして使用）
// ============================================================
export async function getFeatureFlagsForSpace(spaceId: string): Promise<FeatureFlags> {
  // Kill Switch が有効なら全フラグを false
  if (isKillSwitchEnabled()) {
    return buildAllFalse();
  }

  // Supabase 未設定時（ローカル開発・テスト環境）は localStorage override + デフォルト値を返す
  if (!isSupabaseConfigured) {
    const localOverrides = loadLocalOverrides(spaceId);
    return castToFeatureFlags({ ...buildDefaults(), ...localOverrides });
  }

  try {
    // feature_flags と space_feature_flags を並列取得
    const [defaultsResult, overridesResult] = await Promise.all([
      supabase.from('feature_flags').select('key, default_enabled'),
      supabase.from('space_feature_flags').select('flag_key, enabled').eq('space_id', spaceId),
    ]);

    if (defaultsResult.error) throw defaultsResult.error;
    if (overridesResult.error) throw overridesResult.error;

    // デフォルト値をマップに変換
    const result: Record<string, boolean> = {};
    for (const row of (defaultsResult.data ?? []) as FeatureFlagRow[]) {
      result[row.key] = row.default_enabled;
    }

    // Supabase の override で上書き（サーバー値を最優先）
    for (const row of (overridesResult.data ?? []) as SpaceFeatureFlagRow[]) {
      result[row.flag_key] = row.enabled;
    }

    return castToFeatureFlags(result);
  } catch (err) {
    // 取得失敗時のみ localStorage override + デフォルト値にフォールバック
    console.warn('[FeatureFlags] Failed to fetch flags, falling back to defaults.', err);
    const localOverrides = loadLocalOverrides(spaceId);
    return castToFeatureFlags({ ...buildDefaults(), ...localOverrides });
  }
}

// ============================================================
// setSpaceFeatureFlag
// スペース単位のフラグを更新する（管理者UI用）
// Supabase 未設定時・書き込みエラー時は localStorage にフォールバック保存する
// ============================================================
export async function setSpaceFeatureFlag(
  spaceId: string,
  flagKey: FeatureFlagKey,
  enabled: boolean,
  updatedBy?: string,
): Promise<void> {
  // Supabase 未設定時は localStorage のみに保存
  if (!isSupabaseConfigured) {
    saveLocalOverride(spaceId, flagKey, enabled);
    return;
  }

  try {
    const { error } = await supabase
      .from('space_feature_flags')
      .upsert(
        { space_id: spaceId, flag_key: flagKey, enabled, updated_by: updatedBy ?? null },
        { onConflict: 'space_id,flag_key' },
      );

    if (error) throw error;
    // Supabase 書き込み成功時は localStorage の同キーを削除（Supabase を正とする）
    removeLocalOverride(spaceId, flagKey);
  } catch (err) {
    // RLS 等で Supabase 書き込みが失敗した場合は localStorage にフォールバック
    console.warn('[FeatureFlags] Supabase write failed, falling back to localStorage.', err);
    saveLocalOverride(spaceId, flagKey, enabled);
  }
}

// ============================================================
// ヘルパー
// ============================================================

// DB 未設定・フォールバック用のデフォルト値（全フラグのデフォルト）
function buildDefaults(): FeatureFlags {
  return {
    comments_thumbnail: true,
    likes_enabled: false,
    random_recall_enabled: false,
    public_board_mode: false,
    zine_export_enabled: false,
    bubble_shapes_extended: false,
  };
}

function buildAllFalse(): FeatureFlags {
  return {
    comments_thumbnail: false,
    likes_enabled: false,
    random_recall_enabled: false,
    public_board_mode: false,
    zine_export_enabled: false,
    bubble_shapes_extended: false,
  };
}

function castToFeatureFlags(raw: Record<string, boolean>): FeatureFlags {
  return {
    comments_thumbnail: raw['comments_thumbnail'] ?? true,
    likes_enabled: raw['likes_enabled'] ?? false,
    random_recall_enabled: raw['random_recall_enabled'] ?? false,
    public_board_mode: raw['public_board_mode'] ?? false,
    zine_export_enabled: raw['zine_export_enabled'] ?? false,
    bubble_shapes_extended: raw['bubble_shapes_extended'] ?? false,
  };
}
