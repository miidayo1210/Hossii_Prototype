import { useCallback, useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import { useSpaceHossiiFetch } from '../../core/hooks/useSpaceHossiiFetch';
import { buildQueryKeyV2 } from '../../core/utils/hossiiQueryKey';
import { matchesPane, type PaneContext } from '../../core/utils/hossiiPaneMembership';
import { isSupabaseConfigured } from '../../core/supabase';
import { useRouter } from '../../core/hooks/useRouter';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { LogListBody } from './LogListBody';
import styles from './CommentsScreen.module.css';

export const CommentsScreen = () => {
  const { navigate } = useRouter();
  const {
    state,
    getActiveSpaceHossiis,
    getHossiisForQueryKey,
    syncFetchedHossiis,
    setHossiiFetchLoading,
  } = useHossiiStore();
  const { activeSpaceId } = state;
  const { activePane, defaultPane, isLoading: panesLoading } = useSpacePane();

  const paneContext = useMemo((): PaneContext | null => {
    if (!activeSpaceId || !activePane || !defaultPane) return null;
    return {
      spaceId: activeSpaceId,
      activePaneId: activePane.id,
      defaultPaneId: defaultPane.id,
    };
  }, [activeSpaceId, activePane, defaultPane]);

  const commentsQueryKey = useMemo(() => {
    if (!activeSpaceId || !paneContext) return null;
    return buildQueryKeyV2(
      activeSpaceId,
      { kind: 'pane', paneId: paneContext.activePaneId },
      'all',
    );
  }, [activeSpaceId, paneContext]);

  const handleCommentsFetched = useCallback(
    (items: Parameters<typeof syncFetchedHossiis>[0], opts?: { merge?: boolean }) => {
      if (!commentsQueryKey) return;
      syncFetchedHossiis(items, commentsQueryKey, opts);
    },
    [commentsQueryKey, syncFetchedHossiis],
  );

  useSpaceHossiiFetch({
    spaceId: activeSpaceId,
    displayLimit: 'unlimited',
    displayPeriod: 'all',
    paneContext,
    enabled: isSupabaseConfigured && !panesLoading && paneContext !== null,
    onFetched: handleCommentsFetched,
    onLoadingChange: setHossiiFetchLoading,
    getExistingHossiis: () =>
      commentsQueryKey ? getHossiisForQueryKey(commentsQueryKey) : [],
  });

  const hossiis = useMemo(() => {
    if (!paneContext) return [];
    if (isSupabaseConfigured) {
      if (!commentsQueryKey) return [];
      return getHossiisForQueryKey(commentsQueryKey);
    }
    return getActiveSpaceHossiis().filter((h) => matchesPane(h, paneContext));
  }, [
    paneContext,
    commentsQueryKey,
    getHossiisForQueryKey,
    getActiveSpaceHossiis,
  ]);

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
      />
    </div>
  );
};
