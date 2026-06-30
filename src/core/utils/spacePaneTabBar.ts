import type { SpacePane } from '../types/spacePane';
import type { TabBarGroup } from '../types/spacePaneTabBar';
import type { UpdateSpacePanePatch } from '../types/spacePane';
import type { PaneSortOrderUpdate } from './spacePaneManagement';
import { sortPanesForDisplay } from './spacePaneManagement';
import { DEFAULT_FOLDER_ID } from './tabFolderStorage';

export type { TabBarGroup };

// ─── 100B compat (kept for any remaining callers) ────────────────────────────

export function resolveTabBarGroup(pane: SpacePane): TabBarGroup {
  const g = pane.settings?.tabBar?.group;
  return g === 'basket' || g === 'folder' ? 'basket' : 'bar';
}

export function splitPanesByTabBarGroup(visiblePanes: SpacePane[]): {
  barPanes: SpacePane[];
  basketPanes: SpacePane[];
} {
  const sorted = sortPanesForDisplay(visiblePanes);
  return {
    barPanes: sorted.filter((p) => resolveTabBarGroup(p) === 'bar'),
    basketPanes: sorted.filter((p) => resolveTabBarGroup(p) === 'basket'),
  };
}

/** Returns true when the pane can be moved into a folder. */
export function canMovePaneToBasket(pane: SpacePane): boolean {
  return !pane.isDefault;
}

/** @deprecated Use buildTabFolderPatch */
export function buildTabBarGroupPatch(
  pane: SpacePane,
  group: TabBarGroup,
): UpdateSpacePanePatch {
  return buildTabFolderPatch(pane, group === 'basket' ? DEFAULT_FOLDER_ID : null);
}

// ─── 100C: folder-aware helpers ──────────────────────────────────────────────

/**
 * Returns the folder id this pane belongs to, or null for bar panes.
 * Maps legacy 'basket' group to DEFAULT_FOLDER_ID.
 */
export function resolvePaneFolderId(pane: SpacePane): string | null {
  const g = pane.settings?.tabBar?.group;
  if (g === 'basket') return DEFAULT_FOLDER_ID;
  if (g === 'folder') return pane.settings?.tabBar?.folderId ?? DEFAULT_FOLDER_ID;
  return null;
}

/** Splits visible panes into bar panes and a folderId → panes map. */
export function splitPanesByFolders(visiblePanes: SpacePane[]): {
  barPanes: SpacePane[];
  folderMap: Map<string, SpacePane[]>;
} {
  const sorted = sortPanesForDisplay(visiblePanes);
  const barPanes: SpacePane[] = [];
  const folderMap = new Map<string, SpacePane[]>();

  for (const pane of sorted) {
    const folderId = resolvePaneFolderId(pane);
    if (folderId === null) {
      barPanes.push(pane);
    } else {
      if (!folderMap.has(folderId)) folderMap.set(folderId, []);
      folderMap.get(folderId)!.push(pane);
    }
  }

  return { barPanes, folderMap };
}

/**
 * Builds a settings patch that places a pane in a folder (folderId != null)
 * or returns it to the bar (folderId === null).
 */
export function buildTabFolderPatch(
  pane: SpacePane,
  folderId: string | null,
): UpdateSpacePanePatch {
  if (folderId === null) {
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
      tabBar: { group: 'folder' as const, folderId },
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

