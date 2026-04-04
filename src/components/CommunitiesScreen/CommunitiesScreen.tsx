import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { useRouter } from '../../core/hooks/useRouter';
import { useAdminNavigation } from '../../core/contexts/useAdminNavigation';
import { fetchAllCommunities } from '../../core/utils/communitiesApi';
import type { Community, CommunityStatus } from '../../core/utils/communitiesApi';
import { fetchCommunityStats } from '../../core/utils/spacesApi';
import type { CommunityStats } from '../../core/utils/spacesApi';
import styles from './CommunitiesScreen.module.css';

const statusBadge = (status: CommunityStatus) => {
  switch (status) {
    case 'approved': return { label: '承認済み', emoji: '🟢', className: styles.badgeApproved };
    case 'pending':  return { label: '審査中',   emoji: '🟡', className: styles.badgePending };
    case 'rejected': return { label: '却下',     emoji: '🔴', className: styles.badgeRejected };
  }
};

export const CommunitiesScreen = () => {
  const { currentUser, logout } = useAuth();
  const { navigate } = useRouter();
  const { setOverrideCommunity } = useAdminNavigation();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statsCache, setStatsCache] = useState<Map<string, CommunityStats>>(new Map());
  const [loadingStatsId, setLoadingStatsId] = useState<string | null>(null);

  useEffect(() => {
    fetchAllCommunities()
      .then(setCommunities)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  const handleManageSpaces = (community: Community) => {
    setOverrideCommunity(community.id, community.name, community.slug);
    navigate('spaces', community.slug ?? undefined);
  };

  const handleToggleDetail = async (community: Community) => {
    if (expandedId === community.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(community.id);
    if (statsCache.has(community.id)) return;
    setLoadingStatsId(community.id);
    const stats = await fetchCommunityStats(community.id);
    setStatsCache((prev) => new Map(prev).set(community.id, stats));
    setLoadingStatsId(null);
  };

  const handleLogout = async () => {
    setShowAccountMenu(false);
    try {
      await logout();
    } catch (e) {
      console.error('[CommunitiesScreen] logout error:', e);
    }
    window.location.href = '/admin/login';
  };

  return (
    <div className={styles.container}>
      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderLeft}>
          <span className={styles.adminLogo}>✨ Hossii</span>
          <span className={styles.adminPageTitle}>コミュニティ管理</span>
        </div>

        <div className={styles.adminHeaderRight}>
          <div className={styles.accountDropdown} ref={accountMenuRef}>
            <button
              type="button"
              className={styles.accountButton}
              onClick={() => setShowAccountMenu((v) => !v)}
            >
              👤 アカウント
            </button>

            {showAccountMenu && (
              <div className={styles.accountMenu}>
                <div className={styles.accountMenuInfo}>
                  <p className={styles.accountMenuName}>
                    {currentUser?.displayName ?? 'Hossii 運営'}
                  </p>
                  <p className={styles.accountMenuEmail}>
                    {currentUser?.email ?? ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.accountMenuLogout}
                  onClick={handleLogout}
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {loading && (
          <div className={styles.loadingState}>
            <p>読み込み中...</p>
          </div>
        )}

        {!loading && communities.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>🏘️</div>
            <p className={styles.emptyStateText}>登録済みコミュニティはありません</p>
          </div>
        )}

        {!loading && communities.length > 0 && (
          <div className={styles.communityGrid}>
            {communities.map((community) => {
              const badge = statusBadge(community.status);
              return (
                <div key={community.id} className={styles.communityCard}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardName}>{community.name}</h2>
                    <span className={`${styles.statusBadge} ${badge.className}`}>
                      {badge.emoji} {badge.label}
                    </span>
                  </div>

                  <div className={styles.cardMeta}>
                    <span className={styles.cardMetaItem}>
                      登録日: {community.createdAt.toLocaleDateString('ja-JP')}
                    </span>
                    {community.slug && (
                      <span className={styles.cardMetaItem}>
                        ID: {community.slug}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.toggleDetailButton}
                    onClick={() => handleToggleDetail(community)}
                    aria-expanded={expandedId === community.id}
                  >
                    <span>{expandedId === community.id ? '詳細を隠す' : '詳細を見る'}</span>
                    <span className={`${styles.toggleIcon} ${expandedId === community.id ? styles.toggleIconOpen : ''}`}>
                      ▼
                    </span>
                  </button>

                  {expandedId === community.id && (
                    <div className={styles.detailPanel}>
                      {loadingStatsId === community.id ? (
                        <p className={styles.detailLoading}>読み込み中...</p>
                      ) : (() => {
                        const stats = statsCache.get(community.id);
                        if (!stats) return null;
                        return (
                          <div className={styles.statsGrid}>
                            <div className={styles.statItem}>
                              <span className={styles.statLabel}>スペース数</span>
                              <span className={styles.statValue}>{stats.spaceCount} 件</span>
                            </div>
                            <div className={styles.statItem}>
                              <span className={styles.statLabel}>最終作成日</span>
                              <span className={styles.statValue}>
                                {stats.lastActivityAt
                                  ? stats.lastActivityAt.toLocaleDateString('ja-JP')
                                  : '—'}
                              </span>
                            </div>
                            <div className={styles.statItem}>
                              <span className={styles.statLabel}>総投稿数</span>
                              <span className={styles.statValue}>{stats.totalPostCount} 件</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.manageButton}
                      onClick={() => handleManageSpaces(community)}
                    >
                      スペースを管理 →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
