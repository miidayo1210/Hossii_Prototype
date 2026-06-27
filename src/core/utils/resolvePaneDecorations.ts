import type { Space, SpaceDecoration } from '../types/space';
import type { SpacePane } from '../types/spacePane';

/**
 * Resolves decorations for display. Default pane uses space.decorations;
 * additional panes use pane.decorations when non-null (§13.4).
 */
export function resolvePaneDecorations(
  pane: SpacePane | null,
  space: Space | null | undefined,
): SpaceDecoration[] {
  if (!space) return [];
  if (!pane || pane.isDefault) return space.decorations ?? [];

  if (pane.decorations != null) return pane.decorations;

  return space.decorations ?? [];
}
