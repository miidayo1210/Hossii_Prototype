import type { SpacePane } from '../types/spacePane';

export const MAX_SPACE_PANES = 20;
export const MAX_PANE_NAME_LEN = 30;

const SLUG_SINGLE = /^[a-z0-9]$/;
const SLUG_MULTI = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export type PaneSortOrderUpdate = { id: string; sortOrder: number };

export function canCreatePane(paneCount: number): boolean {
  return paneCount < MAX_SPACE_PANES;
}

export function canHidePane(pane: SpacePane): boolean {
  return !pane.isDefault;
}

export function validatePaneName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'タブ名を入力してください';
  if (trimmed.length > MAX_PANE_NAME_LEN) {
    return `${MAX_PANE_NAME_LEN}文字以内で入力してください`;
  }
  return null;
}

export function validatePaneSlug(
  slug: string,
  existingPanes: SpacePane[],
  selfId?: string,
): string | null {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return 'slug を入力してください';

  const validSingle = SLUG_SINGLE.test(trimmed);
  const validMulti = trimmed.length >= 2 && SLUG_MULTI.test(trimmed);
  if (!validSingle && !validMulti) {
    return 'slug は半角英小文字・数字・ハイフンのみ使用できます';
  }

  const taken = existingPanes.some(
    (p) => p.id !== selfId && p.slug.toLowerCase() === trimmed,
  );
  if (taken) return 'この slug は既に使用されています';

  return null;
}

export function sortPanesForDisplay(panes: SpacePane[]): SpacePane[] {
  return [...panes].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
}

export function computeReorderUpdates(
  panes: SpacePane[],
  paneId: string,
  direction: 'up' | 'down',
): PaneSortOrderUpdate[] {
  const sorted = sortPanesForDisplay(panes);
  const index = sorted.findIndex((p) => p.id === paneId);
  if (index < 0) return [];

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return [];

  const next = [...sorted];
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];

  return next.map((pane, i) => ({ id: pane.id, sortOrder: i }));
}

export function paneLimitMessage(): string {
  return `タブは最大 ${MAX_SPACE_PANES} 件まで追加できます`;
}
