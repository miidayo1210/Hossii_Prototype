import { useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useCommentsHossiiFetch } from '../../core/hooks/useSpaceHossiiFetch';
import { buildQueryKeyV2 } from '../../core/utils/hossiiQueryKey';
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

  const commentsQueryKey = useMemo(
    () =>
      activeSpaceId
        ? buildQueryKeyV2(activeSpaceId, { kind: 'all-panes' }, 'all')
        : null,
    [activeSpaceId],
  );

  useCommentsHossiiFetch(
    activeSpaceId,
    (items) => {
      if (commentsQueryKey) syncFetchedHossiis(items, commentsQueryKey);
    },
    setHossiiFetchLoading,
  );

  const hossiis = useMemo(() => {
    if (!commentsQueryKey) return getActiveSpaceHossiis();
    const keyed = getHossiisForQueryKey(commentsQueryKey);
    if (!isSupabaseConfigured && keyed.length === 0) {
      return getActiveSpaceHossiis();
    }
    return keyed.length > 0 ? keyed : getActiveSpaceHossiis();
  }, [commentsQueryKey, getHossiisForQueryKey, getActiveSpaceHossiis]);

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
