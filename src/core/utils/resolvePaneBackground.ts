import type { Space, SpaceBackground } from '../types/space';
import type { SpacePane } from '../types/spacePane';

function isPoolImageBackground(
  background: SpaceBackground,
  pool: string[] | undefined,
): boolean {
  if (background.kind !== 'image') return false;
  return (pool ?? []).includes(background.value);
}

/**
 * Resolves the background for display (§95 §4.4).
 * Default pane uses space.background.
 * Additional panes: NULL → main; image in pool → override; otherwise → main fallback.
 */
export function resolvePaneBackground(
  pane: SpacePane | null,
  space: Space | null | undefined,
): SpaceBackground | undefined {
  if (!space) return undefined;
  if (!pane) return space.background;

  if (pane.isDefault) {
    return space.background;
  }

  const override = pane.background;
  if (override == null) {
    return space.background;
  }

  if (override.kind !== 'image') {
    return space.background;
  }

  if (isPoolImageBackground(override, space.savedBackgroundImages)) {
    return override;
  }

  return space.background;
}
