import type { SpacePane } from '../types/spacePane';
import type { TabBarGroup } from '../types/spacePaneTabBar';
import type { UpdateSpacePanePatch } from '../types/spacePane';
import type { PaneSortOrderUpdate } from './spacePaneManagement';
import { sortPanesForDisplay } from './spacePaneManagement';

export type { TabBarGroup };

export function resolveTabBarGroup(pane: SpacePane): TabBarGroup {
  return pane.settings?.tabBar?.group === 'basket' ? 'basket' : 'bar';
}

export function splitPanesByTabBarGroup(visiblePanes: SpacePane[]): {
  barPanes: SpacePane[];
  basketPanes: SpacePane[];
} {
  const sorted = sortPanesForDisplay(visiblePanes);
  return {
    barPanes: sorted.filter((pane) => resolveTabBarGroup(pane) === 'bar'),
    basketPanes: sorted.filter((pane) => resolveTabBarGroup(pane) === 'basket'),
  };
}

export function canMovePaneToBasket(pane: SpacePane): boolean {
  return !pane.isDefault;
}

export function buildTabBarGroupPatch(
  pane: SpacePane,
  group: TabBarGroup,
): UpdateSpacePanePatch {
  if (group === 'bar') {
    const next = { ...(pane.settings ?? {}) };
    delete next.tabBar;
    const hasOther =
      next.postFields != null ||
      (next.posting != null && next.posting.positionMode != null);
    return { settings: hasOther ? next : null };
  }

  return {
    settings: {
      ...(pane.settings ?? {}),
      tabBar: { group: 'basket' },
    },
  };
}

/** Insert-before index among visible tabs → full pane list sort_order updates. */
export function computeVisiblePaneReorderUpdates(
  allPanes: SpacePane[],
  stripPanes: SpacePane[],
  draggedId: string,
  insertBeforeVisibleIndex: number,
): PaneSortOrderUpdate[] {
  const sortedAll = sortPanesForDisplay(allPanes);
  const sortedStrip = sortPanesForDisplay(stripPanes);
  const fromIdx = sortedStrip.findIndex((p) => p.id === draggedId);
  if (fromIdx < 0) return [];

  let toIdx = Math.max(0, Math.min(insertBeforeVisibleIndex, sortedStrip.length));
  if (fromIdx < toIdx) toIdx -= 1;
  if (fromIdx === toIdx) return [];

  const reorderedStrip = [...sortedStrip];
  const [removed] = reorderedStrip.splice(fromIdx, 1);
  reorderedStrip.splice(toIdx, 0, removed);

  const stripSet = new Set(sortedStrip.map((p) => p.id));
  const stripSlotIndices = sortedAll
    .map((pane, index) => (stripSet.has(pane.id) ? index : -1))
    .filter((index) => index >= 0);

  const next = [...sortedAll];
  stripSlotIndices.forEach((fullIndex, stripIndex) => {
    next[fullIndex] = reorderedStrip[stripIndex]!;
  });

  return next.map((pane, index) => ({ id: pane.id, sortOrder: index }));
}

/** Drop position from pointer X relative to tab button rects (strip order). */
export function resolveInsertBeforeVisibleIndex(
  stripPanes: SpacePane[],
  tabRects: Map<string, DOMRect>,
  clientX: number,
): number {
  for (let i = 0; i < stripPanes.length; i++) {
    const pane = stripPanes[i]!;
    const rect = tabRects.get(pane.id);
    if (!rect) continue;
    const midpoint = rect.left + rect.width / 2;
    if (clientX < midpoint) return i;
  }
  return stripPanes.length;
}

export function isPointInRect(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

