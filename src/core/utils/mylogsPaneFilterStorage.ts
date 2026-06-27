export type MyLogsPaneFilter =
  | { mode: 'current' }
  | { mode: 'all' }
  | { mode: 'specific'; paneId: string };

const STORAGE_PREFIX = 'hossii.mylogsPaneFilter.';

export const DEFAULT_MYLOGS_PANE_FILTER: MyLogsPaneFilter = { mode: 'current' };

function parseStoredFilter(raw: string): MyLogsPaneFilter | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const mode = (parsed as { mode?: unknown }).mode;
    if (mode === 'current' || mode === 'all') return { mode };
    if (mode === 'specific') {
      const paneId = (parsed as { paneId?: unknown }).paneId;
      if (typeof paneId === 'string' && paneId.length > 0) {
        return { mode: 'specific', paneId };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function sanitizeMyLogsPaneFilter(
  filter: MyLogsPaneFilter,
  validPaneIds?: readonly string[],
): MyLogsPaneFilter {
  if (filter.mode !== 'specific') return filter;
  if (!validPaneIds || validPaneIds.length === 0) return DEFAULT_MYLOGS_PANE_FILTER;
  if (validPaneIds.includes(filter.paneId)) return filter;
  return DEFAULT_MYLOGS_PANE_FILTER;
}

export function loadMyLogsPaneFilter(
  spaceId: string | null,
  validPaneIds?: readonly string[],
): MyLogsPaneFilter {
  if (!spaceId) return DEFAULT_MYLOGS_PANE_FILTER;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`);
    if (!raw) return DEFAULT_MYLOGS_PANE_FILTER;
    const parsed = parseStoredFilter(raw);
    if (!parsed) return DEFAULT_MYLOGS_PANE_FILTER;
    return sanitizeMyLogsPaneFilter(parsed, validPaneIds);
  } catch {
    return DEFAULT_MYLOGS_PANE_FILTER;
  }
}

export function saveMyLogsPaneFilter(
  spaceId: string | null,
  filter: MyLogsPaneFilter,
): void {
  if (!spaceId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${spaceId}`, JSON.stringify(filter));
  } catch {
    // ignore
  }
}
