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
 * Pane 単位の糸一覧。fetch 失敗時は空配列のまま（SpaceScreen を止めない）。
 */
export function useHossiiConnections({
  spaceId,
  paneId,
  enabled,
}: UseHossiiConnectionsOptions): UseHossiiConnectionsResult {
  const [connections, setConnections] = useState<HossiiConnection[]>([]);
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const requestIdRef = useRef(0);

  const refetch = useCallback(() => {
    setFetchGeneration((generation) => generation + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !spaceId || !paneId || !isSupabaseConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when fetch gate closes
      setConnections([]);
      return undefined;
    }

    const reqId = ++requestIdRef.current;
    let cancelled = false;

    // Pane / space 変更直後に旧件数を残さない（race guard は reqId で維持）
    setConnections([]);

    void (async () => {
      const result = await fetchConnections(spaceId, paneId);
      if (cancelled || reqId !== requestIdRef.current) return;
      setConnections(result.ok ? result.connections : []);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, spaceId, paneId, fetchGeneration]);

  return { connections, refetch };
}
