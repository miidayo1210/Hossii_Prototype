import type { DisplayPeriod } from '../utils/displayPrefsStorage';
import type { PaneFetchScope } from '../utils/hossiisApi';
import { buildQueryKey, buildQueryKeyV2 } from '../utils/hossiiQueryKey';
import type { PaneContext } from '../utils/hossiiPaneMembership';
import { isDefaultPane } from '../utils/hossiiPaneMembership';

export type PaneFetchScopeOverride =
  | { mode: 'context' }
  | { mode: 'all-panes' }
  | { mode: 'pane'; paneId: string; defaultPaneId: string };

export function resolveSpaceHossiiQueryKey(
  spaceId: string,
  displayPeriod: DisplayPeriod,
  paneContext?: PaneContext | null,
  paneFetchScope?: PaneFetchScopeOverride,
): string {
  if (paneFetchScope?.mode === 'all-panes') {
    return buildQueryKeyV2(spaceId, { kind: 'all-panes' }, displayPeriod);
  }
  if (paneFetchScope?.mode === 'pane') {
    return buildQueryKeyV2(
      spaceId,
      { kind: 'pane', paneId: paneFetchScope.paneId },
      displayPeriod,
    );
  }
  if (paneContext) {
    return buildQueryKeyV2(
      spaceId,
      { kind: 'pane', paneId: paneContext.activePaneId },
      displayPeriod,
    );
  }
  return buildQueryKey(spaceId, displayPeriod);
}

export function resolveSpaceHossiiPaneFilter(
  paneContext?: PaneContext | null,
  paneFetchScope?: PaneFetchScopeOverride,
): PaneFetchScope | undefined {
  if (paneFetchScope?.mode === 'all-panes') {
    return { kind: 'all-panes' };
  }
  if (paneFetchScope?.mode === 'pane') {
    if (paneFetchScope.paneId === paneFetchScope.defaultPaneId) {
      return { kind: 'default', defaultPaneId: paneFetchScope.defaultPaneId };
    }
    return { kind: 'pane', paneId: paneFetchScope.paneId };
  }
  if (!paneContext) return undefined;
  if (isDefaultPane(paneContext)) {
    return { kind: 'default', defaultPaneId: paneContext.defaultPaneId };
  }
  return { kind: 'pane', paneId: paneContext.activePaneId };
}

export function paneFetchScopeOverrideKey(
  paneFetchScope?: PaneFetchScopeOverride,
): string {
  if (!paneFetchScope || paneFetchScope.mode === 'context') return 'context';
  if (paneFetchScope.mode === 'all-panes') return 'all-panes';
  return `pane:${paneFetchScope.paneId}:${paneFetchScope.defaultPaneId}`;
}
