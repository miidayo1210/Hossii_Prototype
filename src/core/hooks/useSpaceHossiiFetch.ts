import { useEffect, useRef, useCallback, useState, type MutableRefObject } from 'react';
import type { Hossii } from '../types';
import { isSupabaseConfigured } from '../supabase';
import { fetchHossiisPage } from '../utils/hossiisApi';
import {
  cursorFromOldest,
  mergeHossiiListsUnique,
  type HossiiPageCursor,
} from '../utils/hossiiFetchPage';
import type { PaneContext } from '../utils/hossiiPaneMembership';
import {
  paneFetchScopeOverrideKey,
  resolveSpaceHossiiPaneFilter,
  resolveSpaceHossiiQueryKey,
  type PaneFetchScopeOverride,
} from '../utils/spaceHossiiFetchResolve';
import {
  getPeriodCutoff,
  type DisplayLimit,
  type DisplayPeriod,
} from '../utils/displayPrefsStorage';

const PAGE_SIZE = 100;
const UI_CHUNK = 50;

export type SpaceHossiiFetchProgress = {
  loading: boolean;
  loadedCount: number;
  fetchComplete: boolean;
};

export type FetchDeliverOptions = {
  merge?: boolean;
};

export type UseSpaceHossiiFetchOptions = {
  spaceId: string | null;
  displayLimit: DisplayLimit;
  displayPeriod: DisplayPeriod;
  /** 訪問モード等で fetch しない */
  enabled: boolean;
  /** default / additional pane context (Phase 2). Omit for legacy v1 fetch. */
  paneContext?: PaneContext | null;
  /** Comments all-panes / specific pane fetch (Phase 9B). Default: context. */
  paneFetchScope?: PaneFetchScopeOverride;
  /** 取得結果を store に反映（optimistic merge 込み） */
  onFetched: (items: Hossii[], options?: FetchDeliverOptions) => void;
  onLoadingChange: (loading: boolean) => void;
  /** 増分 fetch 時に既存 store の同一スペース投稿（ref 経由で最新を参照） */
  getExistingHossiis: () => Hossii[];
};

function numericLimit(displayLimit: DisplayLimit): number | 'unlimited' {
  return displayLimit === 'unlimited' ? 'unlimited' : displayLimit;
}

function idleWait(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 120 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** 増分 UI 反映: 50 件 chunk で onFetched を呼ぶ */
async function deliverInChunks(
  accumulated: Hossii[],
  spaceId: string,
  onFetched: (items: Hossii[], options?: FetchDeliverOptions) => void,
  reqId: number,
  requestIdRef: MutableRefObject<number>,
  prevDelivered: number,
): Promise<number> {
  const spaceCount = accumulated.filter((h) => h.spaceId === spaceId).length;
  let delivered = prevDelivered;

  while (delivered < spaceCount) {
    if (reqId !== requestIdRef.current) return delivered;
    delivered = Math.min(delivered + UI_CHUNK, spaceCount);
    onFetched(accumulated, { merge: true });
    if (delivered < spaceCount) await idleWait();
  }
  return delivered;
}

export function useSpaceHossiiFetch({
  spaceId,
  displayLimit,
  displayPeriod,
  enabled,
  paneContext,
  paneFetchScope,
  onFetched,
  onLoadingChange,
  getExistingHossiis,
}: UseSpaceHossiiFetchOptions): SpaceHossiiFetchProgress {
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const fetchedMetaRef = useRef<{ queryKey: string; count: number } | null>(null);
  const getExistingRef = useRef(getExistingHossiis);
  const onFetchedRef = useRef(onFetched);
  const onLoadingChangeRef = useRef(onLoadingChange);
  getExistingRef.current = getExistingHossiis;
  onFetchedRef.current = onFetched;
  onLoadingChangeRef.current = onLoadingChange;

  const activePaneId = paneContext?.activePaneId ?? null;
  const defaultPaneId = paneContext?.defaultPaneId ?? null;
  const paneFetchScopeKey = paneFetchScopeOverrideKey(paneFetchScope);

  const [progress, setProgress] = useState<SpaceHossiiFetchProgress>({
    loading: false,
    loadedCount: 0,
    fetchComplete: true,
  });

  const runFetch = useCallback(
    async (
      reqId: number,
      targetCount: number | 'unlimited',
      appendFrom: Hossii[],
      cursor: HossiiPageCursor | null,
      fetchSpaceId: string,
      fetchPeriod: DisplayPeriod,
      fetchPaneContext: PaneContext | null | undefined,
      fetchPaneFetchScope: PaneFetchScopeOverride | undefined,
    ) => {
      if (!fetchSpaceId || !isSupabaseConfigured) return;

      const periodCutoff = getPeriodCutoff(fetchPeriod);
      const signal = abortRef.current?.signal;
      const paneFilter = resolveSpaceHossiiPaneFilter(fetchPaneContext, fetchPaneFetchScope);

      if (targetCount === 'unlimited') {
        const upperBound = new Date().toISOString();
        let accumulated = [...appendFrom];
        let nextCursor = cursor;
        let deliveredCount = 0;
        let hasMore = true;

        while (hasMore) {
          const page = await fetchHossiisPage({
            spaceId: fetchSpaceId,
            limit: PAGE_SIZE,
            cursor: nextCursor ?? undefined,
            periodCutoff,
            upperBound,
            signal,
            paneFilter,
          });
          if (reqId !== requestIdRef.current) return;

          if (page.items.length === 0) {
            hasMore = false;
            break;
          }

          accumulated = mergeHossiiListsUnique(accumulated, page.items);
          const count = accumulated.filter((h) => h.spaceId === fetchSpaceId).length;
          setProgress({ loading: true, loadedCount: count, fetchComplete: false });

          deliveredCount = await deliverInChunks(
            accumulated,
            fetchSpaceId,
            (items, opts) => onFetchedRef.current(items, opts),
            reqId,
            requestIdRef,
            deliveredCount,
          );

          nextCursor = page.nextCursor;
          hasMore = page.hasMore;
          if (!hasMore) break;
        }

        if (reqId !== requestIdRef.current) return;
        const finalCount = accumulated.filter((h) => h.spaceId === fetchSpaceId).length;
        onFetchedRef.current(accumulated, { merge: false });
        fetchedMetaRef.current = {
          queryKey: resolveSpaceHossiiQueryKey(
            fetchSpaceId,
            fetchPeriod,
            fetchPaneContext,
            fetchPaneFetchScope,
          ),
          count: finalCount,
        };
        setProgress({ loading: false, loadedCount: finalCount, fetchComplete: true });
        return;
      }

      let accumulated = [...appendFrom];
      let nextCursor = cursor;
      let remaining =
        targetCount - accumulated.filter((h) => h.spaceId === fetchSpaceId).length;

      while (remaining > 0) {
        const batchLimit = Math.min(PAGE_SIZE, remaining);
        const page = await fetchHossiisPage({
          spaceId: fetchSpaceId,
          limit: batchLimit,
          cursor: nextCursor ?? undefined,
          periodCutoff,
          signal,
          paneFilter,
        });
        if (reqId !== requestIdRef.current) return;

        if (page.items.length === 0) break;

        accumulated = mergeHossiiListsUnique(accumulated, page.items);
        remaining =
          targetCount - accumulated.filter((h) => h.spaceId === fetchSpaceId).length;
        nextCursor = page.nextCursor;

        if (!page.hasMore) break;
      }

      onFetchedRef.current(accumulated);
      const count = accumulated.filter((h) => h.spaceId === fetchSpaceId).length;
      fetchedMetaRef.current = {
        queryKey: resolveSpaceHossiiQueryKey(
          fetchSpaceId,
          fetchPeriod,
          fetchPaneContext,
          fetchPaneFetchScope,
        ),
        count,
      };
      setProgress({ loading: false, loadedCount: count, fetchComplete: true });
    },
    [],
  );

  useEffect(() => {
    if (!enabled || !spaceId || !isSupabaseConfigured) {
      onLoadingChangeRef.current(false);
      setProgress({ loading: false, loadedCount: 0, fetchComplete: true });
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const queryKey = resolveSpaceHossiiQueryKey(
      spaceId,
      displayPeriod,
      paneContext,
      paneFetchScope,
    );
    const limit = numericLimit(displayLimit);
    const prev = fetchedMetaRef.current;
    const sameQuery = prev?.queryKey === queryKey;
    const targetCount = limit === 'unlimited' ? 'unlimited' : limit;

    const reqId = ++requestIdRef.current;
    onLoadingChangeRef.current(true);
    setProgress((p) => ({ ...p, loading: true, fetchComplete: false }));

    void (async () => {
      try {
        if (sameQuery && typeof targetCount === 'number' && prev && prev.count >= targetCount) {
          if (reqId === requestIdRef.current) {
            onLoadingChangeRef.current(false);
            setProgress({ loading: false, loadedCount: prev.count, fetchComplete: true });
          }
          return;
        }

        const existing = getExistingRef.current().filter((h) => h.spaceId === spaceId);

        if (
          sameQuery &&
          typeof targetCount === 'number' &&
          prev &&
          prev.count < targetCount &&
          existing.length > 0
        ) {
          const cursor = cursorFromOldest(existing);
          await runFetch(
            reqId,
            targetCount,
            existing,
            cursor,
            spaceId,
            displayPeriod,
            paneContext,
            paneFetchScope,
          );
        } else {
          fetchedMetaRef.current = null;
          await runFetch(
            reqId,
            targetCount,
            [],
            null,
            spaceId,
            displayPeriod,
            paneContext,
            paneFetchScope,
          );
        }
      } finally {
        if (reqId === requestIdRef.current) onLoadingChangeRef.current(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [
    enabled,
    spaceId,
    displayLimit,
    displayPeriod,
    activePaneId,
    defaultPaneId,
    runFetch,
    paneContext,
    paneFetchScopeKey,
    paneFetchScope,
  ]);

  return progress;
}
