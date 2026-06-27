import { useCallback, useMemo, useState } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import { useSpaceHossiiFetch } from '../../core/hooks/useSpaceHossiiFetch';
import { buildQueryKeyV2 } from '../../core/utils/hossiiQueryKey';
import { matchesPane, type PaneContext } from '../../core/utils/hossiiPaneMembership';
import {
  loadCommentsPaneFilter,
  saveCommentsPaneFilter,
  type CommentsPaneFilter,
} from '../../core/utils/commentsPaneFilterStorage';
import type { PaneFetchScopeOverride } from '../../core/utils/spaceHossiiFetchResolve';
import { coerceIsHidden } from '../../core/utils/hossiisApi';
import { isSupabaseConfigured } from '../../core/supabase';
import { useRouter } from '../../core/hooks/useRouter';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { LogListBody } from './LogListBody';
import type { PaneFilterCountMode } from './PaneFilterSegment';
import styles from './CommentsScreen.module.css';

export const CommentsScreen = () => {
  const { navigate } = useRouter();
  const {
    state,
    getActiveSpaceHossiis,
    getHossiisForQueryKey,
    syncFetchedHossiis,
    setHossiiFetchLoading,
    moveHossiiToPane,
  } = useHossiiStore();
  const { activeSpaceId } = state;
  const {
    activePane,
    defaultPane,
    visiblePanes,
    isLoading: panesLoading,
  } = useSpacePane();

  const visiblePaneIds = useMemo(
    () => visiblePanes.map((pane) => pane.id),
    [visiblePanes],
  );
  const visiblePaneIdsKey = visiblePaneIds.join(',');
  const paneFilterStorageKey = `${activeSpaceId ?? ''}:${visiblePaneIdsKey}`;

  const [paneFilterState, setPaneFilterState] = useState(() => ({
    key: paneFilterStorageKey,
    filter: loadCommentsPaneFilter(activeSpaceId, visiblePaneIds),
  }));

  if (paneFilterState.key !== paneFilterStorageKey) {
    setPaneFilterState({
      key: paneFilterStorageKey,
      filter: loadCommentsPaneFilter(
        activeSpaceId,
        visiblePaneIdsKey ? visiblePaneIdsKey.split(',') : [],
      ),
    });
  }

  const paneFilter = paneFilterState.filter;

  const paneContext = useMemo((): PaneContext | null => {
    if (!activeSpaceId || !activePane || !defaultPane) return null;
    return {
      spaceId: activeSpaceId,
      activePaneId: activePane.id,
      defaultPaneId: defaultPane.id,
    };
  }, [activeSpaceId, activePane, defaultPane]);

  const fetchScopeOverride = useMemo((): PaneFetchScopeOverride => {
    if (paneFilter.mode === 'all') return { mode: 'all-panes' };
    if (paneFilter.mode === 'specific' && defaultPane) {
      return {
        mode: 'pane',
        paneId: paneFilter.paneId,
        defaultPaneId: defaultPane.id,
      };
    }
    return { mode: 'context' };
  }, [paneFilter, defaultPane]);

  const commentsQueryKey = useMemo(() => {
    if (!activeSpaceId) return null;
    if (paneFilter.mode === 'all') {
      return buildQueryKeyV2(activeSpaceId, { kind: 'all-panes' }, 'all');
    }
    if (paneFilter.mode === 'specific' && defaultPane) {
      return buildQueryKeyV2(
        activeSpaceId,
        { kind: 'pane', paneId: paneFilter.paneId },
        'all',
      );
    }
    if (!paneContext) return null;
    return buildQueryKeyV2(
      activeSpaceId,
      { kind: 'pane', paneId: paneContext.activePaneId },
      'all',
    );
  }, [activeSpaceId, paneContext, paneFilter, defaultPane]);

  const fetchEnabled = useMemo(() => {
    if (!isSupabaseConfigured || !activeSpaceId || panesLoading) return false;
    if (paneFilter.mode === 'all') return defaultPane !== null;
    if (paneFilter.mode === 'specific') return defaultPane !== null;
    return paneContext !== null;
  }, [activeSpaceId, panesLoading, paneFilter, defaultPane, paneContext]);

  const handleCommentsFetched = useCallback(
    (items: Parameters<typeof syncFetchedHossiis>[0], opts?: { merge?: boolean }) => {
      if (!commentsQueryKey) return;
      syncFetchedHossiis(items, commentsQueryKey, opts);
    },
    [commentsQueryKey, syncFetchedHossiis],
  );

  const fetchProgress = useSpaceHossiiFetch({
    spaceId: activeSpaceId,
    displayLimit: 'unlimited',
    displayPeriod: 'all',
    paneContext,
    paneFetchScope: fetchScopeOverride,
    enabled: fetchEnabled,
    onFetched: handleCommentsFetched,
    onLoadingChange: setHossiiFetchLoading,
    getExistingHossiis: () =>
      commentsQueryKey ? getHossiisForQueryKey(commentsQueryKey) : [],
  });

  const filterPaneContext = useMemo((): PaneContext | null => {
    if (!activeSpaceId || !defaultPane) return null;
    if (paneFilter.mode === 'specific') {
      return {
        spaceId: activeSpaceId,
        activePaneId: paneFilter.paneId,
        defaultPaneId: defaultPane.id,
      };
    }
    return paneContext;
  }, [activeSpaceId, defaultPane, paneFilter, paneContext]);

  const hossiis = useMemo(() => {
    if (!activeSpaceId || !defaultPane) return [];
    if (isSupabaseConfigured) {
      if (!commentsQueryKey) return [];
      return getHossiisForQueryKey(commentsQueryKey);
    }
    const all = getActiveSpaceHossiis();
    if (paneFilter.mode === 'all') return all;
    if (!filterPaneContext) return [];
    return all.filter((h) => matchesPane(h, filterPaneContext));
  }, [
    activeSpaceId,
    defaultPane,
    paneFilter.mode,
    filterPaneContext,
    commentsQueryKey,
    getHossiisForQueryKey,
    getActiveSpaceHossiis,
  ]);

  const getPaneFilterCount = useCallback(
    (mode: PaneFilterCountMode, paneId?: string): number => {
      if (!activeSpaceId || !defaultPane) return 0;

      let key: string | null = null;
      if (mode === 'all') {
        key = buildQueryKeyV2(activeSpaceId, { kind: 'all-panes' }, 'all');
      } else if (mode === 'specific' && paneId) {
        key = buildQueryKeyV2(activeSpaceId, { kind: 'pane', paneId }, 'all');
      } else if (paneContext) {
        key = buildQueryKeyV2(
          activeSpaceId,
          { kind: 'pane', paneId: paneContext.activePaneId },
          'all',
        );
      }

      const countVisible = (items: ReturnType<typeof getActiveSpaceHossiis>) =>
        items.filter((h) => !coerceIsHidden(h.isHidden)).length;

      if (isSupabaseConfigured) {
        if (!key) return 0;
        return countVisible(getHossiisForQueryKey(key));
      }

      const all = getActiveSpaceHossiis();
      if (mode === 'all') return countVisible(all);

      let ctx: PaneContext | null = null;
      if (mode === 'specific' && paneId) {
        ctx = {
          spaceId: activeSpaceId,
          activePaneId: paneId,
          defaultPaneId: defaultPane.id,
        };
      } else {
        ctx = paneContext;
      }
      if (!ctx) return 0;
      return countVisible(all.filter((h) => matchesPane(h, ctx)));
    },
    [
      activeSpaceId,
      defaultPane,
      paneContext,
      getHossiisForQueryKey,
      getActiveSpaceHossiis,
    ],
  );

  const handlePaneFilterChange = useCallback(
    (next: CommentsPaneFilter) => {
      setPaneFilterState({ key: paneFilterStorageKey, filter: next });
      if (activeSpaceId) saveCommentsPaneFilter(activeSpaceId, next);
    },
    [activeSpaceId, paneFilterStorageKey],
  );

  const [movePaneBusyId, setMovePaneBusyId] = useState<string | null>(null);

  const handleMoveHossiiToPane = useCallback(
    async (hossiiId: string, targetPaneId: string) => {
      setMovePaneBusyId(hossiiId);
      try {
        await moveHossiiToPane(hossiiId, targetPaneId);
      } finally {
        setMovePaneBusyId(null);
      }
    },
    [moveHossiiToPane],
  );

  const activeSpace = state.spaces.find((s) => s.id === activeSpaceId);

  return (
    <div className={styles.container}>
      <TopRightMenu />
      <LogListBody
        hossiis={hossiis}
        spaceId={activeSpaceId}
        presetTags={activeSpace?.presetTags ?? []}
        panelMode={false}
        onNavigateToPost={() => navigate('post')}
        paneFilter={paneFilter}
        visiblePanes={visiblePanes}
        activePane={activePane}
        onPaneFilterChange={handlePaneFilterChange}
        getPaneFilterCount={getPaneFilterCount}
        commentsFetchLoading={fetchProgress.loading}
        movePaneVisiblePanes={visiblePanes.length >= 2 ? visiblePanes : undefined}
        movePaneDefaultPaneId={defaultPane?.id}
        onMoveHossiiToPane={handleMoveHossiiToPane}
        movePaneBusyId={movePaneBusyId}
      />
    </div>
  );
};
