import type { Hossii } from '../types';

export type HossiiPageCursor = { createdAt: string; id: string };

/** created_at DESC, id DESC の比較（a が b より新しい → 負） */
export function compareHossiiNewestFirst(a: Hossii, b: Hossii): number {
  const ta = a.createdAt.getTime();
  const tb = b.createdAt.getTime();
  if (ta !== tb) return tb - ta;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** 新しい順にソート（安定: id 二次キー） */
export function sortHossiisNewestFirst(items: Hossii[]): Hossii[] {
  return [...items].sort(compareHossiiNewestFirst);
}

/** keyset: cursor より古い（または同時刻で id 更小）か */
export function isOlderThanCursor(
  item: Pick<Hossii, 'createdAt' | 'id'>,
  cursor: HossiiPageCursor,
): boolean {
  const t = item.createdAt.toISOString();
  if (t < cursor.createdAt) return true;
  if (t > cursor.createdAt) return false;
  return item.id < cursor.id;
}

/** 最古（ページ末尾）から next cursor */
export function cursorFromOldest(items: Hossii[]): HossiiPageCursor | null {
  if (items.length === 0) return null;
  const sorted = sortHossiisNewestFirst(items);
  const oldest = sorted[sorted.length - 1];
  return { createdAt: oldest.createdAt.toISOString(), id: oldest.id };
}

/** ID dedup し新しい順で merge（fetch + optimistic + realtime） */
export function mergeHossiiListsUnique(...lists: Hossii[][]): Hossii[] {
  const byId = new Map<string, Hossii>();
  for (const list of lists) {
    for (const h of list) {
      byId.set(h.id, h);
    }
  }
  return sortHossiisNewestFirst([...byId.values()]);
}

/** PostgREST .or() 用 keyset フィルタ文字列 */
export function buildKeysetOrFilter(cursor: HossiiPageCursor): string {
  const t = cursor.createdAt;
  const id = cursor.id;
  return `created_at.lt.${t},and(created_at.eq.${t},id.lt.${id})`;
}
