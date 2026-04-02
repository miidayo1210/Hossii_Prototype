import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from '../../core/hooks/useRouter';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { fetchNeighbors } from '../../core/utils/neighborsApi';
import { supabase, isSupabaseConfigured } from '../../core/supabase';
import type { Space } from '../../core/types/space';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import styles from './NeighborsScreen.module.css';

type NeighborCard = Space & { recentCount: number };

async function fetchRecentCount(spaceId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('hossiis')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .gte('created_at', since);
  return count ?? 0;
}

export const NeighborsScreen = () => {
  const { navigate } = useRouter();
  const { state, setVisitingSpace } = useHossiiStore();
  const [cards, setCards] = useState<NeighborCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!state.activeSpaceId) return;
      const neighbors = await fetchNeighbors(state.activeSpaceId);
      const withCounts = await Promise.all(
        neighbors.map(async (n) => ({
          ...n,
          recentCount: await fetchRecentCount(n.id),
        })),
      );
      setCards(withCounts);
      setIsLoading(false);
    };
    load();
  }, [state.activeSpaceId]);

  const handleVisit = (neighbor: Space) => {
    setVisitingSpace(neighbor.id);
    navigate('screen');
  };

  const handleOpenNewTab = (neighbor: Space) => {
    if (neighbor.spaceURL) {
      window.open(`/s/${neighbor.spaceURL}`, '_blank');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('screen')}>
          <ArrowLeft size={20} />
          <span>戻る</span>
        </button>
        <div className={styles.headerTitle}>
          <h1 className={styles.title}>隣のスペース</h1>
          <p className={styles.subtitle}>つながっているスペース</p>
        </div>
        <TopRightMenu />
      </header>

      <main className={styles.main}>
        {isLoading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : cards.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🏝</span>
            <p className={styles.emptyText}>まだ隣のスペースはありません</p>
            <p className={styles.emptyHint}>スペース管理画面の「隣のスペース」タブから追加できます。</p>
          </div>
        ) : (
          <ul className={styles.cardList}>
            {cards.map((card) => (
              <li key={card.id} className={styles.card}>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>{card.name}</span>
                  <span className={styles.cardMeta}>最近 7 日間に {card.recentCount} 件の声</span>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.visitButton}
                    onClick={() => handleVisit(card)}
                  >
                    訪問する ↗
                  </button>
                  {card.spaceURL && (
                    <button
                      className={styles.newTabButton}
                      onClick={() => handleOpenNewTab(card)}
                    >
                      別タブ
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};
