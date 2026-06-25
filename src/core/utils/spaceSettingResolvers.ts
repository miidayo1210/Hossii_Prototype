import type { SpaceSettings } from '../types/settings';

type LegacyFeatureFlagFallback = {
  position_selector?: boolean;
  random_recall_enabled?: boolean;
};

/** 投稿位置グリッドを表示するか（正式設定 → FF フォールバック） */
export function resolvePositionSelectorEnabled(
  settings: SpaceSettings | null | undefined,
  flags?: LegacyFeatureFlagFallback,
): boolean {
  const mode = settings?.posting?.positionMode;
  if (mode === 'selector') return true;
  if (mode === 'auto') return false;
  return flags?.position_selector ?? false;
}

/** 振り返り画面のランダム想起を有効にするか */
export function resolveRandomRecallEnabled(
  settings: SpaceSettings | null | undefined,
  flags?: LegacyFeatureFlagFallback,
): boolean {
  if (settings?.reflection?.randomRecallEnabled !== undefined) {
    return settings.reflection.randomRecallEnabled;
  }
  return flags?.random_recall_enabled ?? false;
}

/** スペース canvas PNG 書き出しを許可するか（Phase 3: 管理者常時 ON） */
export function resolveCanvasExportAllowed(isAdmin: boolean): boolean {
  return isAdmin;
}
