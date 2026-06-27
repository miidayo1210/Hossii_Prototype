import type { SpacePane } from '../types/spacePane';

export type ResolveActivePaneInput = {
  paneSlug: string | null;
  visiblePanes: SpacePane[];
  defaultPane: SpacePane;
};

export type ResolveActivePaneResult = {
  activePane: SpacePane;
  shouldSanitizeUrl: boolean;
};

/**
 * Resolve active pane for Space screen from URL slug and visible panes.
 * Hidden panes are excluded via visiblePanes — admin direct URL still falls back to default.
 */
export function resolveActivePane(input: ResolveActivePaneInput): ResolveActivePaneResult {
  const { paneSlug, visiblePanes, defaultPane } = input;

  if (!paneSlug) {
    return { activePane: defaultPane, shouldSanitizeUrl: false };
  }

  const match = visiblePanes.find((p) => p.slug === paneSlug);
  if (match) {
    return { activePane: match, shouldSanitizeUrl: false };
  }

  return { activePane: defaultPane, shouldSanitizeUrl: true };
}
