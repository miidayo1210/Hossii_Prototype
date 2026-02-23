/**
 * 表示フィルタの設定を localStorage に保存/読み込み
 * スペースごとに保存される
 */

// フィルタの型
export type HossiiFilters = {
  manual: boolean; // 手動投稿
  autoEmotion: boolean; // 自動:感情
  autoSpeech: boolean; // 自動:言葉
  autoLaughter: boolean; // 自動:笑い
};

// デフォルト設定（全てON）
export const DEFAULT_FILTERS: HossiiFilters = {
  manual: true,
  autoEmotion: true,
  autoSpeech: true,
  autoLaughter: true,
};

const STORAGE_KEY_PREFIX = 'hossii.filters.';

/**
 * フィルタ設定を読み込む
 */
export function loadFilters(spaceId: string): HossiiFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + spaceId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        manual: parsed.manual ?? true,
        autoEmotion: parsed.autoEmotion ?? true,
        autoSpeech: parsed.autoSpeech ?? true,
        autoLaughter: parsed.autoLaughter ?? true,
      };
    }
    return DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

/**
 * フィルタ設定を保存
 */
export function saveFilters(spaceId: string, filters: HossiiFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + spaceId, JSON.stringify(filters));
  } catch {
    // ignore
  }
}
