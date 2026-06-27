import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';

/**
 * Resolves saved background image URLs for the background picker.
 */
export function resolvePaneSavedBackgroundImages(
  pane: SpacePane | null,
  space: Space | null | undefined,
): string[] | undefined {
  if (!space) return undefined;
  if (!pane || pane.isDefault) return space.savedBackgroundImages;

  if (pane.savedBackgroundImages != null) {
    return pane.savedBackgroundImages;
  }

  return space.savedBackgroundImages;
}
