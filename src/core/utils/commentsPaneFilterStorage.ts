export type CommentsPaneFilter =
  | { mode: 'current' }
  | { mode: 'all' }
  | { mode: 'specific'; paneId: string };

const STORAGE_PREFIX = 'hossii.commentsPaneFilter.';

export function commentsPaneFilterStorageKey(spaceId: string): string {
  return `${STORAGE_PREFIX}${spaceId}`;
}

export const DEFAULT_COMMENTS_PANE_FILTER: CommentsPaneFilter = { mode: 'current' };

function parseStoredFilter(raw: string): CommentsPaneFilter | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const mode = (parsed as { mode?: unknown }).mode;
    if (mode === 'current' || mode === 'all') {
      return { mode };
    }
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

export function sanitizeCommentsPaneFilter(
  filter: CommentsPaneFilter,
  validPaneIds?: readonly string[],
): CommentsPaneFilter {
  if (filter.mode !== 'specific') return filter;
  if (!validPaneIds || validPaneIds.length === 0) return DEFAULT_COMMENTS_PANE_FILTER;
  if (validPaneIds.includes(filter.paneId)) return filter;
  return DEFAULT_COMMENTS_PANE_FILTER;
}

export function loadCommentsPaneFilter(
  spaceId: string | null,
  validPaneIds?: readonly string[],
): CommentsPaneFilter {
  if (!spaceId) return DEFAULT_COMMENTS_PANE_FILTER;
  try {
    const raw = localStorage.getItem(commentsPaneFilterStorageKey(spaceId));
    if (!raw) return DEFAULT_COMMENTS_PANE_FILTER;
    const parsed = parseStoredFilter(raw);
    if (!parsed) return DEFAULT_COMMENTS_PANE_FILTER;
    return sanitizeCommentsPaneFilter(parsed, validPaneIds);
  } catch {
    return DEFAULT_COMMENTS_PANE_FILTER;
  }
}

export function saveCommentsPaneFilter(
  spaceId: string | null,
  filter: CommentsPaneFilter,
): void {
  if (!spaceId) return;
  try {
    localStorage.setItem(commentsPaneFilterStorageKey(spaceId), JSON.stringify(filter));
  } catch {
    // ignore
  }
}
