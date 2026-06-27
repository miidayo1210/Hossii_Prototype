import type { PostingSettings, SpaceSettings } from '../types/settings';
import { DEFAULT_POSTING_SETTINGS } from '../types/settings';
import type { SpacePane } from '../types/spacePane';

export type PositionMode = PostingSettings['positionMode'];

/**
 * Resolves posting position mode. Default pane uses space_settings.posting;
 * additional panes inherit unless settings.posting.positionMode is set.
 */
export function resolvePanePositionMode(
  pane: SpacePane | null,
  settings: SpaceSettings | null | undefined,
): PositionMode {
  const base = settings?.posting?.positionMode ?? DEFAULT_POSTING_SETTINGS.positionMode;
  if (!pane || pane.isDefault) return base;

  const override = pane.settings?.posting?.positionMode;
  if (override == null) return base;

  return override;
}
