import { useState, useMemo, useEffect, useCallback } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAuth } from '../../core/contexts/useAuth';
import { isOwnHossii } from '../../core/utils/isOwnHossii';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import { getRelativeTime } from '../../core/utils/relativeTime';
import { matchesPane, type PaneContext } from '../../core/utils/hossiiPaneMembership';
import {
  loadMyLogsPaneFilter,
  saveMyLogsPaneFilter,
  type MyLogsPaneFilter,
} from '../../core/utils/mylogsPaneFilterStorage';
import { PaneFilterSegment, type PaneFilterCountMode, type PaneFilterValue } from '../CommentsScreen/PaneFilterSegment';
import { coerceIsHidden } from '../../core/utils/hossiisApi';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import styles from './MyLogsScreen.module.css';

type FilterType = 'all' | 'current';

export const MyLogsScreen = () => {
  const { state, getActiveSpaceHossiis, myAuthorshipIds, refreshMyAuthorshipIds } = useHossiiStore();
  const { currentUser } = useAuth();
  const { hossiis, spaces, profile, activeSpaceId } = state;
  const { visiblePanes, defaultPane, activePane } = useSpacePane();

  const visiblePaneIds = useMemo(
    () => visiblePanes.map((pane) => pane.id),
    [visiblePanes],
  );
  const visiblePaneIdsKey = visiblePaneIds.join(',');
  const paneFilterStorageKey = `${activeSpaceId ?? ''}:${visiblePaneIdsKey}`;

  const [filter, setFilter] = useState<FilterType>('all');
  const [paneFilterState, setPaneFilterState] = useState(() => ({
    key: paneFilterStorageKey,
    filter: loadMyLogsPaneFilter(activeSpaceId, visiblePaneIds),
  }));

  if (paneFilterState.key !== paneFilterStorageKey) {
    setPaneFilterState({
      key: paneFilterStorageKey,
      filter: loadMyLogsPaneFilter(
        activeSpaceId,
        visiblePaneIdsKey ? visiblePaneIdsKey.split(',') : [],
      ),
    });
  }

  const paneFilter = paneFilterState.filter;

  const [sortOrder, setSortOrder] = useState<'newest' | 'likes'>('newest');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const guestProfileId = profile?.id;

  const isMineHossii = useCallback(
    (h: (typeof hossiis)[number]) =>
      isOwnHossii(h, myAuthorshipIds, guestProfileId),
    [myAuthorshipIds, guestProfileId],
  );

  useEffect(() => {
    if (currentUser) {
      void refreshMyAuthorshipIds();
    }
  }, [currentUser, refreshMyAuthorshipIds]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxUrl]);

  const getSpaceName = (spaceId: string): string => {
    const space = spaces.find((f) => f.id === spaceId);
    return space?.name ?? '不明なスペース';
  };

  const paneContext = useMemo((): PaneContext | null => {
    if (!activeSpaceId || !defaultPane) return null;
    if (paneFilter.mode === 'specific') {
      return {
        spaceId: activeSpaceId,
        activePaneId: paneFilter.paneId,
        defaultPaneId: defaultPane.id,
      };
    }
    if (activePane) {
      return {
        spaceId: activeSpaceId,
        activePaneId: activePane.id,
        defaultPaneId: defaultPane.id,
      };
    }
    return null;
  }, [activeSpaceId, defaultPane, activePane, paneFilter]);

  const getPaneFilterCount = (mode: PaneFilterCountMode, paneId?: string): number => {
    if (!activeSpaceId || !defaultPane) return 0;

    const countVisible = (items: typeof hossiis) =>
      items.filter(
        (h) =>
          isMineHossii(h) &&
          h.spaceId === activeSpaceId &&
          !coerceIsHidden(h.isHidden),
      ).length;

    if (mode === 'all') {
      return countVisible(hossiis.filter((h) => h.spaceId === activeSpaceId));
    }

    let ctx: PaneContext | null = null;
    if (mode === 'specific' && paneId) {
      ctx = {
        spaceId: activeSpaceId,
        activePaneId: paneId,
        defaultPaneId: defaultPane.id,
      };
    } else if (activePane) {
      ctx = {
        spaceId: activeSpaceId,
        activePaneId: activePane.id,
        defaultPaneId: defaultPane.id,
      };
    }
    if (!ctx) return 0;
    return countVisible(getActiveSpaceHossiis().filter((h) => matchesPane(h, ctx!)));
  };

  const handlePaneFilterChange = (next: PaneFilterValue) => {
    const myLogsFilter = next as MyLogsPaneFilter;
    setPaneFilterState({ key: paneFilterStorageKey, filter: myLogsFilter });
    if (activeSpaceId) saveMyLogsPaneFilter(activeSpaceId, myLogsFilter);
  };

  const myLogs = useMemo(() => {
    const seen = new Set<string>();
    let logs = hossiis.filter((h) => {
      if (!isMineHossii(h)) return false;
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });

    if (filter === 'current') {
      logs = logs.filter((h) => h.spaceId === activeSpaceId);
      if (paneContext && paneFilter.mode !== 'all') {
        logs = logs.filter((h) => matchesPane(h, paneContext));
      }
    }

    return logs.sort((a, b) =>
      sortOrder === 'likes'
        ? (b.likeCount ?? 0) - (a.likeCount ?? 0)
        : b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }, [
    hossiis,
    isMineHossii,
    filter,
    activeSpaceId,
    sortOrder,
    paneContext,
    paneFilter.mode,
  ]);

  const currentSpaceName = getSpaceName(activeSpaceId);
  const showPaneFilter =
    filter === 'current' && visiblePanes.length >= 2 && defaultPane != null;

  return (
    <div className={styles.container}>
      <TopRightMenu />

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>マイログ</h1>
            <p className={styles.subtitle}>あなたが残したログ</p>
          </div>
          <div className={styles.filterGroup}>
            <button
              type="button"
              className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('all')}
            >
              すべて
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${filter === 'current' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('current')}
              title={currentSpaceName}
            >
              このスペース
            </button>
          </div>
        </div>
        {showPaneFilter && (
          <div className={styles.paneFilterWrap}>
            <PaneFilterSegment
              filter={paneFilter}
              visiblePanes={visiblePanes}
              activePane={activePane}
              getCount={getPaneFilterCount}
              onChange={handlePaneFilterChange}
            />
          </div>
        )}
        <div className={styles.sortBar}>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortOrder === 'newest' ? styles.sortBtnActive : ''}`}
            onClick={() => setSortOrder('newest')}
          >
            新着順
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortOrder === 'likes' ? styles.sortBtnActive : ''}`}
            onClick={() => setSortOrder('likes')}
          >
            ❤️ いいね順
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.count}>{myLogs.length} 件</div>

        <div className={styles.list}>
          {myLogs.length === 0 ? (
            <div className={styles.empty}>
              {!profile?.id && !currentUser
                ? 'まだ投稿がありません'
                : filter === 'current'
                  ? 'このスペースへの投稿はまだありません'
                  : '投稿履歴がありません'}
            </div>
          ) : (
            myLogs.map((hossii, index) => {
              const spaceName = getSpaceName(hossii.spaceId);
              const relativeTime = getRelativeTime(hossii.createdAt);
              const emoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;

              return (
                <article
                  key={hossii.id}
                  className={styles.card}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.spacePill}>{spaceName}</span>
                    <span className={styles.time}>{relativeTime}</span>
                  </div>

                  {renderHossiiText(hossii) && (
                    <p className={styles.message}>{renderHossiiText(hossii)}</p>
                  )}

                  {hossii.imageUrl && (
                    <button
                      type="button"
                      className={styles.imageThumb}
                      onClick={() => setLightboxUrl(hossii.imageUrl!)}
                      aria-label="画像を拡大表示"
                    >
                      <img
                        src={hossii.imageUrl}
                        alt="投稿画像"
                        className={styles.thumbImg}
                        loading="lazy"
                      />
                      <span className={styles.thumbHint}>タップして拡大</span>
                    </button>
                  )}

                  {(hossii.authorName || emoji) && (
                    <div className={styles.cardFooter}>
                      {hossii.authorName && (
                        <span className={styles.authorName}>{hossii.authorName}</span>
                      )}
                      {emoji && <span className={styles.emotionChip}>{emoji}</span>}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </main>

      {lightboxUrl && (
        <div
          className={styles.lightbox}
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="画像拡大表示"
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightboxUrl(null)}
            aria-label="閉じる"
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="拡大画像"
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
