import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';

/**
 * Resolves default bubble shape PNG. Stored on spaces / space_panes.bubble_shape_png.
 */
export function resolvePaneBubbleShapePng(
  pane: SpacePane | null,
  space: Space | null | undefined,
): string | undefined {
  if (!space) return undefined;
  if (!pane || pane.isDefault) return space.bubbleShapePng;

  if (pane.bubbleShapePng != null) {
    return pane.bubbleShapePng || undefined;
  }

  return space.bubbleShapePng;
}

/** True when a non-default pane has an explicit bubble_shape_png override column. */
export function hasPaneBubbleShapeOverride(pane: SpacePane | null): boolean {
  return pane != null && !pane.isDefault && pane.bubbleShapePng != null;
}
