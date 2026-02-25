/**
 * 表示フィルタの設定を localStorage に保存/読み込み
 * スペースごとに保存される
 *
 * 投稿種別の判定ルール:
 *   comment  … origin が manual（または未設定）かつ message が空でない
 *   emotion  … emotion フィールドが設定されている（manual/auto 問わず）
 * 両方に該当する投稿は、どちらかの filter が ON なら表示される
 */

// フィルタの型
export type HossiiFilters = {
  comment: boolean;  // コメント（テキスト投稿）
  emotion: boolean;  // 気持ち（emotion が設定された投稿）
};

// デフォルト設定（全てON）
export const DEFAULT_FILTERS: HossiiFilters = {
  comment: true,
  emotion: true,
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
        comment: parsed.comment ?? true,
        emotion: parsed.emotion ?? true,
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
