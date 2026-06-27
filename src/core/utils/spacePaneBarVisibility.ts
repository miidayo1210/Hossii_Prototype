/**
 * Whether the Space pane tab bar should render (§6.2 / §6.3 / §30.7).
 */
export function shouldShowSpacePaneBar(
  isAdmin: boolean,
  visiblePaneCount: number,
  isVisiting: boolean,
  panesLoading: boolean,
): boolean {
  if (isVisiting || panesLoading) return false;
  if (isAdmin) return visiblePaneCount >= 1;
  return visiblePaneCount >= 2;
}
