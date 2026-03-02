import { supabase, isSupabaseConfigured } from '../supabase';

// ============================================================
// Feature Flag キーの定義
// 新しいフラグを追加する時はここに追加する
// ============================================================
export type FeatureFlagKey = 'comments_thumbnail';

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
// getFeatureFlagsForSpace
// スペース単位のフラグを取得して、default + override をマージして返す
//
// 優先順位（A段階）: space_feature_flags.enabled > feature_flags.default_enabled
// B段階では: user > space > tenant > default に拡張予定（docs/feature-flags.md 参照）
// ============================================================
export async function getFeatureFlagsForSpace(spaceId: string): Promise<FeatureFlags> {
  // Kill Switch が有効なら全フラグを false
  if (isKillSwitchEnabled()) {
    return buildAllFalse();
  }

  // Supabase 未設定時（ローカル開発・テスト環境）はデフォルト値を返す
  if (!isSupabaseConfigured) {
    return buildDefaults();
  }

  try {
    // feature_flags テーブルからデフォルト値を全件取得
    const { data: defaults, error: defaultsError } = await supabase
      .from('feature_flags')
      .select('key, default_enabled');

    if (defaultsError) throw defaultsError;

    // space_feature_flags テーブルからスペース固有の override を取得
    const { data: overrides, error: overridesError } = await supabase
      .from('space_feature_flags')
      .select('flag_key, enabled')
      .eq('space_id', spaceId);

    if (overridesError) throw overridesError;

    // デフォルト値をマップに変換
    const result: Record<string, boolean> = {};
    for (const row of (defaults ?? []) as FeatureFlagRow[]) {
      result[row.key] = row.default_enabled;
    }

    // override で上書き
    for (const row of (overrides ?? []) as SpaceFeatureFlagRow[]) {
      result[row.flag_key] = row.enabled;
    }

    return castToFeatureFlags(result);
  } catch (err) {
    // 取得失敗時はデフォルト値（全 false）にフォールバック
    console.warn('[FeatureFlags] Failed to fetch flags, falling back to defaults.', err);
    return buildDefaults();
  }
}

// ============================================================
// setSpaceFeatureFlag
// スペース単位のフラグを更新する（管理者UI用）
// ============================================================
export async function setSpaceFeatureFlag(
  spaceId: string,
  flagKey: FeatureFlagKey,
  enabled: boolean,
  updatedBy?: string,
): Promise<void> {
  const { error } = await supabase
    .from('space_feature_flags')
    .upsert(
      { space_id: spaceId, flag_key: flagKey, enabled, updated_by: updatedBy ?? null },
      { onConflict: 'space_id,flag_key' },
    );

  if (error) throw error;
}

// ============================================================
// ヘルパー
// ============================================================

// DB 未設定・フォールバック用のデフォルト値（全フラグのデフォルト）
function buildDefaults(): FeatureFlags {
  return {
    comments_thumbnail: true,
  };
}

function buildAllFalse(): FeatureFlags {
  return {
    comments_thumbnail: false,
  };
}

function castToFeatureFlags(raw: Record<string, boolean>): FeatureFlags {
  return {
    comments_thumbnail: raw['comments_thumbnail'] ?? true,
  };
}
