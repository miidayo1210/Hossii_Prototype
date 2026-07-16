import type { PostFieldSettings, SpaceSettings } from '../types/settings';
import type { SpacePane } from '../types/spacePane';
import { mergePanePostFieldOverride, resolvePostFields } from './postFieldSettings';

/**
 * Resolves post form field config for a pane. Default pane uses space_settings;
 * additional panes inherit unless settings.postFields is set (§13.4).
 */
export function resolvePanePostFields(
  pane: SpacePane | null,
  settings: SpaceSettings | null | undefined,
): PostFieldSettings {
  const base = resolvePostFields(settings);
  if (!pane || pane.isDefault) return base;

  const override = pane.settings?.postFields;
  if (override == null) return base;

  return mergePanePostFieldOverride(base, override);
}
