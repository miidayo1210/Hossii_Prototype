import type { SpacePane } from '../types/spacePane';
import { resolvePaneFolderId, splitPanesByFolders } from './spacePaneTabBar';

export const DEFAULT_FOLDER_ID = 'default';
export const DEFAULT_FOLDER_NAME = 'カゴ';
export const ORPHAN_FOLDER_NAME = 'フォルダ';

export type TabFolder = {
  id: string;
  name: string;
  sortOrder: number;
  /**
   * Place this folder immediately before the given bar pane.
   * `null` / omitted = after all bar panes (legacy default).
   */
  beforePaneId?: string | null;
};

export type TabBarStripItem =
  | { kind: 'pane'; pane: SpacePane }
  | { kind: 'folder'; folder: TabFolder };

export const DEFAULT_FOLDER: TabFolder = {
  id: DEFAULT_FOLDER_ID,
  name: DEFAULT_FOLDER_NAME,
  sortOrder: 0,
};

const LEGACY_FOLDERS_KEY = (id: string) => `hossii.tabFolders:${id}`;
const OPEN_KEY = (spaceId: string, folderId: string) =>
  `hossii.tabFolderOpen:${spaceId}:${folderId}`;

function readBeforePaneId(row: Record<string, unknown>): string | null | undefined {
  if (!('beforePaneId' in row)) return undefined;
  const v = row.beforePaneId;
  if (v === null) return null;
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

export function parseTabFolders(raw: unknown): TabFolder[] {
  if (!Array.isArray(raw)) return [];
  const parsed: TabFolder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id) continue;
    if (typeof row.name !== 'string' || !row.name.trim()) continue;
    if (typeof row.sortOrder !== 'number' || !Number.isFinite(row.sortOrder)) continue;
    const beforePaneId = readBeforePaneId(row);
    const folder: TabFolder = {
      id: row.id,
      name: row.name.trim(),
      sortOrder: row.sortOrder,
    };
    if (beforePaneId !== undefined) {
      folder.beforePaneId = beforePaneId;
    }
    parsed.push(folder);
  }
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Normalize stored folder list for persistence (empty → undefined caller-side). */
export function normalizeStoredTabFolders(folders: TabFolder[]): TabFolder[] {
  return [...folders]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((folder, index) => {
      const next: TabFolder = {
        id: folder.id,
        name: folder.name,
        sortOrder: index,
      };
      if (folder.beforePaneId !== undefined) {
        next.beforePaneId = folder.beforePaneId;
      }
      return next;
    });
}

/**
 * Resolve effective beforePaneId for layout.
 * Missing / invalid pane id → end of bar (`null`).
 */
export function resolveEffectiveBeforePaneId(
  folder: TabFolder,
  barPaneIds: ReadonlySet<string>,
): string | null {
  const id = folder.beforePaneId;
  if (id == null || id === '') return null;
  if (!barPaneIds.has(id)) return null;
  return id;
}

/**
 * Interleave bar panes and folder chips for SpacePaneBar.
 * Folders with the same beforePaneId keep relative sortOrder.
 */
export function buildTabBarStrip(
  barPanes: SpacePane[],
  folders: TabFolder[],
): TabBarStripItem[] {
  const barPaneIds = new Set(barPanes.map((p) => p.id));
  const byBefore = new Map<string | null, TabFolder[]>();

  const sortedFolders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const folder of sortedFolders) {
    const key = resolveEffectiveBeforePaneId(folder, barPaneIds);
    const list = byBefore.get(key);
    if (list) list.push(folder);
    else byBefore.set(key, [folder]);
  }

  const strip: TabBarStripItem[] = [];
  for (const pane of barPanes) {
    for (const folder of byBefore.get(pane.id) ?? []) {
      strip.push({ kind: 'folder', folder });
    }
    strip.push({ kind: 'pane', pane });
  }
  for (const folder of byBefore.get(null) ?? []) {
    strip.push({ kind: 'folder', folder });
  }
  return strip;
}

/**
 * Rebuild folder list (beforePaneId + sortOrder) from a strip order.
 */
export function foldersFromTabBarStrip(strip: TabBarStripItem[]): TabFolder[] {
  const result: TabFolder[] = [];
  let i = 0;
  while (i < strip.length) {
    const item = strip[i];
    if (!item || item.kind === 'pane') {
      i += 1;
      continue;
    }

    let beforePaneId: string | null = null;
    for (let j = i + 1; j < strip.length; j++) {
      const next = strip[j];
      if (next?.kind === 'pane') {
        beforePaneId = next.pane.id;
        break;
      }
    }

    while (i < strip.length && strip[i]?.kind === 'folder') {
      const folderItem = strip[i] as { kind: 'folder'; folder: TabFolder };
      result.push({
        ...folderItem.folder,
        beforePaneId,
      });
      i += 1;
    }
  }

  return result.map((folder, index) => ({ ...folder, sortOrder: index }));
}

/**
 * Move a folder to `insertBeforeStripIndex` in the interleaved strip.
 * Returns null when the dragged folder is missing or the order is unchanged.
 */
export function applyFolderStripInsert(
  barPanes: SpacePane[],
  folders: TabFolder[],
  draggedId: string,
  insertBeforeStripIndex: number,
): TabFolder[] | null {
  const strip = buildTabBarStrip(barPanes, folders);
  const fromIdx = strip.findIndex(
    (item) => item.kind === 'folder' && item.folder.id === draggedId,
  );
  if (fromIdx < 0) return null;

  let toIdx = Math.max(0, Math.min(insertBeforeStripIndex, strip.length));
  const without = [...strip];
  const [removed] = without.splice(fromIdx, 1);
  if (!removed || removed.kind !== 'folder') return null;

  if (fromIdx < toIdx) toIdx -= 1;
  toIdx = Math.max(0, Math.min(toIdx, without.length));

  without.splice(toIdx, 0, removed);
  const nextFolders = foldersFromTabBarStrip(without);
  const prevNormalized = normalizeStoredTabFolders(folders);
  const nextNormalized = normalizeStoredTabFolders(nextFolders);
  const unchanged =
    prevNormalized.length === nextNormalized.length &&
    prevNormalized.every(
      (f, i) =>
        f.id === nextNormalized[i]!.id &&
        f.name === nextNormalized[i]!.name &&
        (f.beforePaneId ?? null) === (nextNormalized[i]!.beforePaneId ?? null),
    );
  return unchanged ? null : nextFolders;
}

/**
 * Set a folder's beforePaneId (end of that slot). Returns null when unchanged.
 */
export function repositionTabFolder(
  folders: TabFolder[],
  folderId: string,
  beforePaneId: string | null,
): TabFolder[] | null {
  const sorted = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((f) => f.id === folderId);
  if (idx < 0) return null;

  const current = sorted[idx]!;
  const currentBefore = current.beforePaneId ?? null;
  if (currentBefore === beforePaneId) return null;

  const next = sorted.map((folder) =>
    folder.id === folderId ? { ...folder, beforePaneId } : folder,
  );
  return normalizeStoredTabFolders(next);
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

/** Reorder folders by drag-drop insert index (folder-only list). Returns null when unchanged. */
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

/**
 * Resolve insert-before index on the interleaved strip from pointer X.
 * `itemRects` keys are `pane:{id}` or `folder:{id}`.
 */
export function resolveStripInsertBeforeIndex(
  strip: TabBarStripItem[],
  itemRects: Map<string, DOMRect>,
  clientX: number,
): number {
  for (let i = 0; i < strip.length; i++) {
    const item = strip[i]!;
    const key =
      item.kind === 'pane' ? `pane:${item.pane.id}` : `folder:${item.folder.id}`;
    const rect = itemRects.get(key);
    if (!rect) continue;
    if (clientX < rect.left + rect.width / 2) return i;
  }
  return strip.length;
}

/** @deprecated Prefer resolveStripInsertBeforeIndex for bar↔folder placement. */
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

export function stripItemKey(item: TabBarStripItem): string {
  return item.kind === 'pane' ? `pane:${item.pane.id}` : `folder:${item.folder.id}`;
}
