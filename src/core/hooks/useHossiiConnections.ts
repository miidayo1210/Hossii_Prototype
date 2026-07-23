import { useEffect, useRef, useState, useCallback } from 'react';
import type { HossiiConnection } from '../types/hossiiConnection';
import { isSupabaseConfigured } from '../supabase';
import { fetchConnections } from '../utils/hossiiConnectionsApi';

export type UseHossiiConnectionsOptions = {
  spaceId: string;
  paneId: string;
  enabled: boolean;
};

export type UseHossiiConnectionsResult = {
  connections: HossiiConnection[];
  refetch: () => void;
  /** 直近 fetch/refetch が失敗したとき true。成功または gate 無効で false */
  fetchError: boolean;
  /** fetch / refetch 実行中 */
  isFetching: boolean;
};

/**
 * Pane 単位の糸一覧。
 * 初回 fetch 失敗時は空配列。refetch 失敗時は既存表示を維持（SpaceScreen を止めない）。
 */
export function useHossiiConnections({
  spaceId,
  paneId,
  enabled,
}: UseHossiiConnectionsOptions): UseHossiiConnectionsResult {
  const [connections, setConnections] = useState<HossiiConnection[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const requestIdRef = useRef(0);
  const fetchInFlightRef = useRef(false);
  const scopeRef = useRef<{ spaceId: string; paneId: string; enabled: boolean } | null>(null);

  const refetch = useCallback(() => {
    if (fetchInFlightRef.current) return;
    setFetchGeneration((generation) => generation + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !spaceId || !paneId || !isSupabaseConfigured) {
      scopeRef.current = null;
      fetchInFlightRef.current = false;
      setConnections([]);
      setFetchError(false);
      setIsFetching(false);
      return undefined;
    }

    const reqId = ++requestIdRef.current;
    let cancelled = false;

    const isScopeChange =
      scopeRef.current === null ||
      scopeRef.current.spaceId !== spaceId ||
      scopeRef.current.paneId !== paneId ||
      scopeRef.current.enabled !== enabled;
    scopeRef.current = { spaceId, paneId, enabled };

    // Pane / space 変更時のみ即クリア。refetch 中は既存表示を維持する。
    if (isScopeChange) {
      setConnections([]);
      setFetchError(false);
    }

    fetchInFlightRef.current = true;
    setIsFetching(true);

    void (async () => {
      try {
        const result = await fetchConnections(spaceId, paneId);
        if (cancelled || reqId !== requestIdRef.current) return;
        if (result.ok) {
          setConnections(result.connections);
          setFetchError(false);
        } else {
          if (isScopeChange) {
            setConnections([]);
          }
          setFetchError(true);
        }
      } finally {
        if (reqId === requestIdRef.current) {
          fetchInFlightRef.current = false;
          setIsFetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, spaceId, paneId, fetchGeneration]);

  return { connections, refetch, fetchError, isFetching };
}
