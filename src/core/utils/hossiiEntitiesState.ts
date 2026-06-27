import type { Hossii } from '../types';
import { parseQueryKey, type HossiiQueryKey } from './hossiiQueryKey';
import { compareHossiiNewestFirst, mergeHossiiListsUnique } from './hossiiFetchPage';

export type HossiiEntitiesSlice = {
  entitiesById: Record<string, Hossii>;
  orderedIdsByQueryKey: Record<HossiiQueryKey, string[]>;
};

export function createEmptyEntitiesSlice(): HossiiEntitiesSlice {
  return { entitiesById: {}, orderedIdsByQueryKey: {} };
}

export function upsertEntities(
  slice: HossiiEntitiesSlice,
  items: Hossii[],
): HossiiEntitiesSlice {
  if (items.length === 0) return slice;
  const entitiesById = { ...slice.entitiesById };
  for (const h of items) {
    entitiesById[h.id] = h;
  }
  return { ...slice, entitiesById };
}

export function patchEntity(
  slice: HossiiEntitiesSlice,
  hossii: Hossii,
): HossiiEntitiesSlice {
  return {
    ...slice,
    entitiesById: {
      ...slice.entitiesById,
      [hossii.id]: { ...slice.entitiesById[hossii.id], ...hossii },
    },
  };
}

export function removeEntity(
  slice: HossiiEntitiesSlice,
  id: string,
  spaceId?: string,
): HossiiEntitiesSlice {
  const existing = slice.entitiesById[id];
  const targetSpaceId = spaceId ?? existing?.spaceId;
  const restEntities = { ...slice.entitiesById };
  delete restEntities[id];

  const orderedIdsByQueryKey = { ...slice.orderedIdsByQueryKey };
  for (const [key, ids] of Object.entries(orderedIdsByQueryKey)) {
    const parsed = parseQueryKey(key);
    if (targetSpaceId && parsed?.spaceId !== targetSpaceId) continue;
    if (targetSpaceId && !parsed && !key.startsWith(`${targetSpaceId}:`)) continue;
    if (ids.includes(id)) {
      orderedIdsByQueryKey[key as HossiiQueryKey] = ids.filter((x) => x !== id);
    }
  }

  return { entitiesById: restEntities, orderedIdsByQueryKey };
}

export function setOrderedIdsForQuery(
  slice: HossiiEntitiesSlice,
  queryKey: HossiiQueryKey,
  ids: string[],
): HossiiEntitiesSlice {
  return {
    ...slice,
    orderedIdsByQueryKey: {
      ...slice.orderedIdsByQueryKey,
      [queryKey]: ids,
    },
  };
}

/** fetch 結果を entity + orderedIds に反映 */
export function applyFetchResult(
  slice: HossiiEntitiesSlice,
  queryKey: HossiiQueryKey,
  items: Hossii[],
  mergeWithExistingIds: boolean,
): HossiiEntitiesSlice {
  let next = upsertEntities(slice, items);
  const prevIds = mergeWithExistingIds ? (slice.orderedIdsByQueryKey[queryKey] ?? []) : [];
  const mergedItems = mergeHossiiListsUnique(
    prevIds.map((id) => next.entitiesById[id]).filter(Boolean),
    items,
  );
  const ids = mergedItems.map((h) => h.id);
  next = upsertEntities(next, mergedItems);
  next = setOrderedIdsForQuery(next, queryKey, ids);
  return next;
}

export function insertOrderedId(
  slice: HossiiEntitiesSlice,
  queryKey: HossiiQueryKey,
  id: string,
  hossii: Hossii,
): HossiiEntitiesSlice {
  let next = upsertEntities(slice, [hossii]);
  const prev = next.orderedIdsByQueryKey[queryKey] ?? [];
  if (prev.includes(id)) return next;
  const combined = mergeHossiiListsUnique(
    [hossii],
    prev.map((pid) => next.entitiesById[pid]).filter(Boolean),
  );
  next = upsertEntities(next, combined);
  return setOrderedIdsForQuery(
    next,
    queryKey,
    combined.map((h) => h.id),
  );
}

export function getHossiisForQueryKey(
  slice: HossiiEntitiesSlice,
  queryKey: HossiiQueryKey | null | undefined,
): Hossii[] {
  if (!queryKey) return [];
  const ids = slice.orderedIdsByQueryKey[queryKey] ?? [];
  return ids.map((id) => slice.entitiesById[id]).filter(Boolean);
}

/** orderedIds 再構築が必要か（いいねのみ UPDATE では false） */
export function shouldReindexOrderedIds(
  prev: Hossii | undefined,
  next: Hossii,
): boolean {
  if (!prev) return true;
  if (prev.createdAt.getTime() !== next.createdAt.getTime()) return true;
  if (prev.spaceId !== next.spaceId) return true;
  if (Boolean(prev.isHidden) !== Boolean(next.isHidden)) return true;
  return false;
}

export function reindexIdInAllQueryKeys(
  slice: HossiiEntitiesSlice,
  id: string,
): HossiiEntitiesSlice {
  const h = slice.entitiesById[id];
  if (!h) return slice;
  const orderedIdsByQueryKey = { ...slice.orderedIdsByQueryKey };
  for (const key of Object.keys(orderedIdsByQueryKey)) {
    const ids = orderedIdsByQueryKey[key as HossiiQueryKey];
    if (!ids.includes(id)) continue;
    const list = ids.map((i) => slice.entitiesById[i]).filter(Boolean);
    list.sort(compareHossiiNewestFirst);
    orderedIdsByQueryKey[key as HossiiQueryKey] = list.map((x) => x.id);
  }
  return { ...slice, orderedIdsByQueryKey };
}

/** hossiis[] 互換: active space の全 entity（query 無視） */
export function materializeHossiisArray(
  slice: HossiiEntitiesSlice,
  spaceId: string,
): Hossii[] {
  return Object.values(slice.entitiesById)
    .filter((h) => h.spaceId === spaceId)
    .sort(compareHossiiNewestFirst);
}
