import {
  insertOrderedId,
  removeOrderedIdFromQueryKey,
  upsertEntities,
  type HossiiEntitiesSlice,
} from './hossiiEntitiesState';
import { parseQueryKey, queryKeysForHossii, type HossiiQueryKey } from './hossiiQueryKey';
import type { Hossii } from '../types';

/** After spacePaneId changes, add/remove id from each cached query key for the space. */
export function reconcileHossiiQueryKeys(
  slice: HossiiEntitiesSlice,
  hossii: Hossii,
): HossiiEntitiesSlice {
  let next = upsertEntities(slice, [hossii]);
  const targetKeySet = new Set(queryKeysForHossii(next, hossii));

  for (const key of Object.keys(next.orderedIdsByQueryKey)) {
    const parsed = parseQueryKey(key);
    if (parsed && parsed.spaceId !== hossii.spaceId) continue;
    if (!parsed && !key.startsWith(`${hossii.spaceId}:`)) continue;

    const queryKey = key as HossiiQueryKey;
    const ids = next.orderedIdsByQueryKey[queryKey] ?? [];
    const inList = ids.includes(hossii.id);
    const shouldInclude = targetKeySet.has(queryKey);

    if (shouldInclude && !inList) {
      next = insertOrderedId(next, queryKey, hossii.id, hossii);
    } else if (!shouldInclude && inList) {
      next = removeOrderedIdFromQueryKey(next, queryKey, hossii.id);
    }
  }

  for (const key of targetKeySet) {
    const ids = next.orderedIdsByQueryKey[key] ?? [];
    if (!ids.includes(hossii.id)) {
      next = insertOrderedId(next, key, hossii.id, hossii);
    }
  }

  return next;
}
