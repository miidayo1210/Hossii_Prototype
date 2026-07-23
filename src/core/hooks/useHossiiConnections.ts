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
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const requestIdRef = useRef(0);
  const scopeRef = useRef<{ spaceId: string; paneId: string; enabled: boolean } | null>(null);

  const refetch = useCallback(() => {
    setFetchGeneration((generation) => generation + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !spaceId || !paneId || !isSupabaseConfigured) {
      scopeRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when fetch gate closes
      setConnections([]);
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
    }

    void (async () => {
      const result = await fetchConnections(spaceId, paneId);
      if (cancelled || reqId !== requestIdRef.current) return;
      if (result.ok) {
        setConnections(result.connections);
      } else if (isScopeChange) {
        setConnections([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, spaceId, paneId, fetchGeneration]);

  return { connections, refetch };
}
