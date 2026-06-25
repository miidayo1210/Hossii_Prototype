/** スペース表示のアニメーション tier（87 §8） */
export type AnimationLevel = 'full' | 'light' | 'none';

/** displayIds 内の新しい順インデックス（0 = 最新）からデフォルト level */
export function defaultAnimationLevelByIndex(index: number): AnimationLevel {
  if (index <= 9) return 'full';
  if (index <= 29) return 'light';
  return 'none';
}

/** ランダム配置: アニメ対象（index ≤ 29）を手前に。0 = 最新 = 最前面 */
export function displayStackZFromIndex(index: number): number {
  if (index <= 29) return 80 - index;
  return Math.max(1, 15 - Math.min(index - 30, 14));
}

export type AnimationLevelBoost = {
  /** 選択・ホバー・プレビュー等で full 昇格 */
  promoteFull?: boolean;
  /** 新着強調等で light 以上 */
  promoteLight?: boolean;
};

/** インデックスベース + 一時昇格を合成 */
export function resolveAnimationLevel(
  index: number,
  boost: AnimationLevelBoost = {},
): AnimationLevel {
  if (boost.promoteFull) return 'full';
  const base = defaultAnimationLevelByIndex(index);
  if (boost.promoteLight && base === 'none') return 'light';
  return base;
}
