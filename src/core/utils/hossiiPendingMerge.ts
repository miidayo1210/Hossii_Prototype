import type { MutableRefObject } from 'react';
import type { Hossii } from '../types';
import { defaultSpacePaneId } from './spacePanesApi';
import {
  hossiiMatchesParsedQueryKey,
  parseQueryKey,
  type HossiiQueryKey,
} from './hossiiQueryKey';

/**
 * Fetch の応答が INSERT / Realtime より先に届くと楽観投稿が一覧に無い — その行を消さないようマージする。
 * 対象 queryKey の Pane scope に一致する pending のみ extras に含める。
 */
export function mergeFetchedHossiisWithPendingInserts(
  serverList: Hossii[],
  activeSpaceId: string,
  currentHossiis: Hossii[],
  pendingInsertIdsRef: MutableRefObject<Set<string>>,
  pendingOptimisticByIdRef: MutableRefObject<Map<string, Hossii>>,
  queryKey: HossiiQueryKey,
): Hossii[] {
  const pending = pendingInsertIdsRef.current;
  const backup = pendingOptimisticByIdRef.current;
  for (const h of serverList) {
    pending.delete(h.id);
    backup.delete(h.id);
  }
  if (pending.size === 0) return serverList;

  const parsed = parseQueryKey(queryKey);
  const defaultPaneId = defaultSpacePaneId(activeSpaceId);

  const matchesQuery = (h: Hossii): boolean => {
    if (!parsed) return h.spaceId === activeSpaceId;
    return hossiiMatchesParsedQueryKey(h, parsed, defaultPaneId);
  };

  const serverIds = new Set(serverList.map((h) => h.id));
  const extras: Hossii[] = [];
  for (const id of pending) {
    if (serverIds.has(id)) continue;
    const fromState = currentHossiis.find((h) => h.id === id);
    if (fromState && matchesQuery(fromState)) {
      extras.push(fromState);
      continue;
    }
    const b = backup.get(id);
    if (b && b.spaceId === activeSpaceId && matchesQuery(b)) {
      extras.push(b);
    }
  }
  return extras.length === 0 ? serverList : [...serverList, ...extras];
}
