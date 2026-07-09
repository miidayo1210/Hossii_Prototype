import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SpacePane } from '../types/spacePane';
import { isSupabaseConfigured, supabase } from '../supabase';
import { ensureDefaultSpacePane } from '../utils/ensureDefaultSpacePane';
import { loadDemoSpacePanesForSpace } from '../utils/demoSpacePanesStorage';
import {
  defaultSpacePaneId,
  fetchDefaultSpacePane,
  fetchSpacePanes,
} from '../utils/spacePanesApi';
import {
  pushPaneSlug,
  readPaneSlugFromUrl,
  replacePaneSlug,
} from '../utils/paneUrl';
import { resolveActivePane } from '../utils/resolveActivePane';
import { useHossiiStore } from './useHossiiStore';
import { useSpacePaneRuntimeRef } from './spacePaneRuntime';

export type SpacePaneContextValue = {
  panes: SpacePane[];
  visiblePanes: SpacePane[];
  defaultPane: SpacePane | null;
  activePane: SpacePane | null;
  activePaneId: string | null;
  isLoading: boolean;
  error: Error | null;
  setActivePaneById: (paneId: string) => void;
  setActivePaneBySlug: (slug: string) => void;
  reloadPanes: () => Promise<void>;
  reloadPanesAndSyncActive: () => Promise<void>;
};

const SpacePaneContext = createContext<SpacePaneContextValue | null>(null);

function createDemoDefaultPane(spaceId: string): SpacePane {
  const now = new Date();
  return {
    id: defaultSpacePaneId(spaceId),
    spaceId,
    name: 'メイン',
    slug: 'main',
    sortOrder: 0,
    isDefault: true,
    isVisible: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function loadPanesForSpace(spaceId: string): Promise<SpacePane[]> {
  if (!isSupabaseConfigured) {
    const stored = loadDemoSpacePanesForSpace(spaceId);
    if (stored.length === 0) return [createDemoDefaultPane(spaceId)];
    if (stored.some((p) => p.isDefault)) return stored;
    const defaultPane = createDemoDefaultPane(spaceId);
    return [defaultPane, ...stored].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
  }

  let panes = await fetchSpacePanes(spaceId);
  if (panes.length === 0) {
    const healed = await ensureDefaultSpacePane(spaceId);
    if (healed) {
      panes = [healed];
    } else {
      panes = await fetchSpacePanes(spaceId);
    }
  }

  if (panes.length === 0) {
    const fallback = await fetchDefaultSpacePane(spaceId);
    if (fallback) panes = [fallback];
  }

  return panes;
}

function pickDefaultPane(panes: SpacePane[], spaceId: string): SpacePane {
  return panes.find((p) => p.isDefault) ?? panes[0] ?? createDemoDefaultPane(spaceId);
}

type PaneSnapshot = {
  panes: SpacePane[];
  defaultPane: SpacePane;
  visiblePanes: SpacePane[];
};

function resolveFromUrl(
  snapshot: PaneSnapshot,
  options?: { sanitizeUrl?: boolean },
): SpacePane {
  const { activePane, shouldSanitizeUrl } = resolveActivePane({
    paneSlug: readPaneSlugFromUrl(),
    visiblePanes: snapshot.visiblePanes,
    defaultPane: snapshot.defaultPane,
  });

  if (shouldSanitizeUrl && options?.sanitizeUrl !== false) {
    replacePaneSlug(null);
  }

  return activePane;
}

export function SpacePaneProvider({ children }: { children: ReactNode }) {
  const { state } = useHossiiStore();
  const activeSpaceId = state.activeSpaceId;
  const runtimeRef = useSpacePaneRuntimeRef();

  const [panes, setPanes] = useState<SpacePane[]>([]);
  const [defaultPane, setDefaultPane] = useState<SpacePane | null>(null);
  const [activePane, setActivePane] = useState<SpacePane | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);
  const snapshotRef = useRef<PaneSnapshot | null>(null);

  const visiblePanes = useMemo(
    () => panes.filter((p) => p.isVisible),
    [panes],
  );

  const activePaneId = activePane?.id ?? null;

  const applySnapshot = useCallback((snapshot: PaneSnapshot, nextActive: SpacePane) => {
    snapshotRef.current = snapshot;
    setPanes(snapshot.panes);
    setDefaultPane(snapshot.defaultPane);
    setActivePane(nextActive);
  }, []);

  const loadForSpace = useCallback(
    async (spaceId: string, reqId: number) => {
      setIsLoading(true);
      setError(null);
      setActivePane(null);
      runtimeRef.current = {
        spaceId,
        activePaneId: null,
        defaultPaneId: null,
      };

      try {
        const loaded = await loadPanesForSpace(spaceId);
        if (reqId !== requestIdRef.current) return;

        if (isSupabaseConfigured && loaded.length === 0) {
          setError(new Error('スペースのタブを読み込めませんでした。'));
          setActivePane(null);
          runtimeRef.current = {
            spaceId,
            activePaneId: null,
            defaultPaneId: null,
          };
          return;
        }

        const def = pickDefaultPane(loaded, spaceId);
        const snapshot: PaneSnapshot = {
          panes: loaded,
          defaultPane: def,
          visiblePanes: loaded.filter((p) => p.isVisible),
        };
        const resolved = resolveFromUrl(snapshot);
        applySnapshot(snapshot, resolved);
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        const message = err instanceof Error ? err : new Error(String(err));
        setError(message);
        if (isSupabaseConfigured) {
          setActivePane(null);
          runtimeRef.current = {
            spaceId,
            activePaneId: null,
            defaultPaneId: null,
          };
          return;
        }
        const fallback = createDemoDefaultPane(spaceId);
        const snapshot: PaneSnapshot = {
          panes: [fallback],
          defaultPane: fallback,
          visiblePanes: [fallback],
        };
        applySnapshot(snapshot, fallback);
      } finally {
        if (reqId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [applySnapshot, runtimeRef],
  );

  const reloadPanes = useCallback(async () => {
    if (!activeSpaceId) return;
    const reqId = ++requestIdRef.current;
    await loadForSpace(activeSpaceId, reqId);
  }, [activeSpaceId, loadForSpace]);

  const reloadPanesAndSyncActive = useCallback(async () => {
    if (!activeSpaceId) return;

    const previousActiveId = activePane?.id ?? null;
    const reqId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const loaded = await loadPanesForSpace(activeSpaceId);
      if (reqId !== requestIdRef.current) return;

      const def = pickDefaultPane(loaded, activeSpaceId);
      const snapshot: PaneSnapshot = {
        panes: loaded,
        defaultPane: def,
        visiblePanes: loaded.filter((p) => p.isVisible),
      };

      let nextActive: SpacePane;
      if (previousActiveId) {
        const byId = loaded.find((p) => p.id === previousActiveId);
        if (byId?.isVisible) {
          nextActive = byId;
          pushPaneSlug(byId.slug);
        } else {
          nextActive = def;
          replacePaneSlug(null);
        }
      } else {
        nextActive = resolveFromUrl(snapshot);
      }

      applySnapshot(snapshot, nextActive);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      const message = err instanceof Error ? err : new Error(String(err));
      setError(message);
    } finally {
      if (reqId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeSpaceId, activePane?.id, applySnapshot]);

  useEffect(() => {
    if (!activeSpaceId) {
      requestIdRef.current += 1;
      snapshotRef.current = null;
      setPanes([]);
      setDefaultPane(null);
      setActivePane(null);
      setIsLoading(false);
      setError(null);
      runtimeRef.current = {
        spaceId: null,
        activePaneId: null,
        defaultPaneId: null,
      };
      return;
    }

    const reqId = ++requestIdRef.current;
    void loadForSpace(activeSpaceId, reqId);
  }, [activeSpaceId, loadForSpace, runtimeRef]);

  useLayoutEffect(() => {
    if (!activeSpaceId) {
      runtimeRef.current = {
        spaceId: null,
        activePaneId: null,
        defaultPaneId: null,
      };
      return;
    }

    if (isLoading || !defaultPane) {
      runtimeRef.current = {
        spaceId: activeSpaceId,
        activePaneId: null,
        defaultPaneId: defaultPane?.id ?? null,
      };
      return;
    }

    runtimeRef.current = {
      spaceId: activeSpaceId,
      activePaneId: activePane?.id ?? null,
      defaultPaneId: defaultPane.id,
    };
  }, [activeSpaceId, activePane?.id, defaultPane, isLoading, runtimeRef]);

  const setActivePaneBySlug = useCallback(
    (slug: string) => {
      const snapshot = snapshotRef.current;
      if (!snapshot || !activeSpaceId) return;

      const match = snapshot.visiblePanes.find((p) => p.slug === slug);
      if (!match) return;

      setActivePane(match);
      pushPaneSlug(slug);
    },
    [activeSpaceId],
  );

  const setActivePaneById = useCallback(
    (paneId: string) => {
      const snapshot = snapshotRef.current;
      if (!snapshot || !activeSpaceId) return;

      const match = snapshot.visiblePanes.find((p) => p.id === paneId);
      if (!match) return;

      setActivePane(match);
      pushPaneSlug(match.slug);
    },
    [activeSpaceId],
  );

  useEffect(() => {
    const onPopState = () => {
      const snapshot = snapshotRef.current;
      if (!snapshot || !activeSpaceId) return;

      const resolved = resolveFromUrl(snapshot, { sanitizeUrl: true });
      setActivePane(resolved);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeSpaceId]);

  useEffect(() => {
    if (!activeSpaceId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`space_panes:${activeSpaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'space_panes',
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          void reloadPanesAndSyncActive();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'space_panes',
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          void reloadPanesAndSyncActive();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeSpaceId, reloadPanesAndSyncActive]);

  const value = useMemo(
    (): SpacePaneContextValue => ({
      panes,
      visiblePanes,
      defaultPane,
      activePane,
      activePaneId,
      isLoading,
      error,
      setActivePaneById,
      setActivePaneBySlug,
      reloadPanes,
      reloadPanesAndSyncActive,
    }),
    [
      panes,
      visiblePanes,
      defaultPane,
      activePane,
      activePaneId,
      isLoading,
      error,
      setActivePaneById,
      setActivePaneBySlug,
      reloadPanes,
      reloadPanesAndSyncActive,
    ],
  );

  return (
    <SpacePaneContext.Provider value={value}>{children}</SpacePaneContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useSpacePane(): SpacePaneContextValue {
  const ctx = useContext(SpacePaneContext);
  if (!ctx) {
    throw new Error('useSpacePane must be used within SpacePaneProvider');
  }
  return ctx;
}
