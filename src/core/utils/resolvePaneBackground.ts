import type { Space, SpaceBackground } from '../types/space';
import type { SpacePane } from '../types/spacePane';

/**
 * Resolves the background for display. Default pane uses space.background;
 * additional panes use pane.background ?? space.background (§13.4 / §13.6).
 */
export function resolvePaneBackground(
  pane: SpacePane | null,
  space: Space | null | undefined,
): SpaceBackground | undefined {
  if (!pane || !space) return space?.background;

  if (pane.isDefault) {
    return space.background;
  }

  return pane.background ?? space.background;
}
