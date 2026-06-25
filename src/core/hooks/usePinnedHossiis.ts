import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadPinnedIds, savePinnedIds } from '../utils/pinnedHossiisStorage';

export function usePinnedHossiis(spaceId: string | undefined) {
  const [pinnedOrder, setPinnedOrder] = useState<string[]>(() =>
    spaceId ? loadPinnedIds(spaceId) : [],
  );

  useEffect(() => {
    if (spaceId) {
      setPinnedOrder(loadPinnedIds(spaceId));
    } else {
      setPinnedOrder([]);
    }
  }, [spaceId]);

  const persist = useCallback(
    (next: string[]) => {
      if (!spaceId) return;
      setPinnedOrder(next);
      savePinnedIds(spaceId, next);
    },
    [spaceId],
  );

  const isPinned = useCallback(
    (id: string) => pinnedOrder.includes(id),
    [pinnedOrder],
  );

  const pin = useCallback(
    (id: string) => {
      if (!spaceId || pinnedOrder.includes(id)) return;
      persist([...pinnedOrder, id]);
    },
    [spaceId, pinnedOrder, persist],
  );

  const unpin = useCallback(
    (id: string) => {
      if (!spaceId || !pinnedOrder.includes(id)) return;
      persist(pinnedOrder.filter((x) => x !== id));
    },
    [spaceId, pinnedOrder, persist],
  );

  const toggle = useCallback(
    (id: string) => {
      if (isPinned(id)) unpin(id);
      else pin(id);
    },
    [isPinned, pin, unpin],
  );

  const pinnedIds = useMemo(() => new Set(pinnedOrder), [pinnedOrder]);

  return {
    pinnedIds,
    pinnedOrder,
    isPinned,
    pin,
    unpin,
    toggle,
  };
}
