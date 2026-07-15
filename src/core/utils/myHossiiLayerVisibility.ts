/**
 * マイHossii参加者レイヤーを表示するか。
 * - enabled=OFF なら常に非表示
 * - enabled=ON なら default pane（is_default）のときだけ表示
 */
export function shouldShowMyHossiiLayer(
  enabled: boolean,
  isDefaultPane: boolean,
): boolean {
  if (!enabled) return false;
  return isDefaultPane;
}
