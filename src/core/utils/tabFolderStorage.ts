import type { SpacePane } from '../types/spacePane';
import { resolvePaneFolderId, splitPanesByFolders } from './spacePaneTabBar';

export const DEFAULT_FOLDER_ID = 'default';
export const DEFAULT_FOLDER_NAME = 'カゴ';
export const ORPHAN_FOLDER_NAME = 'フォルダ';

export type TabFolder = {
  id: string;
  name: string;
  sortOrder: number;
};

export const DEFAULT_FOLDER: TabFolder = {
  id: DEFAULT_FOLDER_ID,
  name: DEFAULT_FOLDER_NAME,
  sortOrder: 0,
};

const LEGACY_FOLDERS_KEY = (id: string) => `hossii.tabFolders:${id}`;
const OPEN_KEY = (spaceId: string, folderId: string) =>
  `hossii.tabFolderOpen:${spaceId}:${folderId}`;

export function parseTabFolders(raw: unknown): TabFolder[] {
  if (!Array.isArray(raw)) return [];
  const parsed: TabFolder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id) continue;
    if (typeof row.name !== 'string' || !row.name.trim()) continue;
    if (typeof row.sortOrder !== 'number' || !Number.isFinite(row.sortOrder)) continue;
    parsed.push({
      id: row.id,
      name: row.name.trim(),
      sortOrder: row.sortOrder,
    });
  }
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Normalize stored folder list for persistence (empty → undefined caller-side). */
export function normalizeStoredTabFolders(folders: TabFolder[]): TabFolder[] {
  return [...folders]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((folder, index) => ({ ...folder, sortOrder: index }));
}

/**
 * Build the folder chip list for SpacePaneBar.
 * - Injects virtual default folder when panes use it but it is not stored.
 * - Synthesizes placeholder folders for pane assignments missing from storage (orphans).
 */
export function resolveEffectiveTabFolders(
  storedFolders: TabFolder[],
  visiblePanes: SpacePane[],
  options: { isAdmin: boolean },
): TabFolder[] {
  const { folderMap } = splitPanesByFolders(visiblePanes);
  const hasDefaultPanes = (folderMap.get(DEFAULT_FOLDER_ID) ?? []).length > 0;
  const sortedStored = normalizeStoredTabFolders(storedFolders);
  const hasDefaultInStored = sortedStored.some((f) => f.id === DEFAULT_FOLDER_ID);

  const result: TabFolder[] = [];
  if ((options.isAdmin || hasDefaultPanes) && !hasDefaultInStored) {
    result.push(DEFAULT_FOLDER);
  }
  result.push(...sortedStored);

  for (const [folderId, panes] of folderMap) {
    if (panes.length === 0) continue;
    if (result.some((f) => f.id === folderId)) continue;
    result.push({
      id: folderId,
      name: ORPHAN_FOLDER_NAME,
      sortOrder: result.length,
    });
  }

  return result.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** @deprecated Pre-2026-07 localStorage only. Use Space.tabFolders. */
export function loadLegacyLocalTabFolders(spaceId: string): TabFolder[] {
  try {
    const raw = localStorage.getItem(LEGACY_FOLDERS_KEY(spaceId));
    if (!raw) return [];
    return parseTabFolders(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function clearLegacyLocalTabFolders(spaceId: string): void {
  try {
    localStorage.removeItem(LEGACY_FOLDERS_KEY(spaceId));
  } catch {
    // ignore
  }
}

/** One-time migration: copy legacy local folders into space when DB/cache is empty. */
export function migrateLegacyLocalTabFoldersIfNeeded(
  spaceId: string,
  spaceFolders: TabFolder[] | undefined,
): TabFolder[] | null {
  if (spaceFolders && spaceFolders.length > 0) return null;
  const legacy = loadLegacyLocalTabFolders(spaceId);
  if (legacy.length === 0) return null;
  return normalizeStoredTabFolders(legacy);
}

export function loadTabFolderOpen(spaceId: string, folderId: string): boolean {
  try {
    if (folderId === DEFAULT_FOLDER_ID) {
      const legacy = localStorage.getItem(`hossii.tabBasketOpen:${spaceId}`);
      if (legacy !== null) return legacy === '1';
    }
    return localStorage.getItem(OPEN_KEY(spaceId, folderId)) === '1';
  } catch {
    return false;
  }
}

export function saveTabFolderOpen(spaceId: string, folderId: string, open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY(spaceId, folderId), open ? '1' : '0');
  } catch {
    // ignore
  }
}

/** Reorder folders by drag-drop insert index. Returns null when unchanged. */
export function reorderTabFolders(
  folders: TabFolder[],
  draggedId: string,
  insertBeforeIndex: number,
): TabFolder[] | null {
  const sorted = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
  const fromIdx = sorted.findIndex((f) => f.id === draggedId);
  if (fromIdx < 0) return null;

  let toIdx = Math.max(0, Math.min(insertBeforeIndex, sorted.length));
  if (fromIdx < toIdx) toIdx -= 1;
  if (fromIdx === toIdx) return null;

  const reordered = [...sorted];
  const [removed] = reordered.splice(fromIdx, 1);
  reordered.splice(toIdx, 0, removed);

  return reordered.map((folder, index) => ({ ...folder, sortOrder: index }));
}

export function resolveFolderInsertBeforeIndex(
  folders: TabFolder[],
  chipRects: Map<string, DOMRect>,
  clientX: number,
): number {
  const sorted = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 0; i < sorted.length; i++) {
    const rect = chipRects.get(sorted[i]!.id);
    if (!rect) continue;
    if (clientX < rect.left + rect.width / 2) return i;
  }
  return sorted.length;
}

export function folderIdsReferencedByPanes(visiblePanes: SpacePane[]): Set<string> {
  const ids = new Set<string>();
  for (const pane of visiblePanes) {
    const folderId = resolvePaneFolderId(pane);
    if (folderId) ids.add(folderId);
  }
  return ids;
}
