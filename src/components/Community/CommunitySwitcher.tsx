import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import styles from './CommunitySwitcher.module.css';

type Props = {
  onNavigateHome?: (communityId: string) => void;
};

const statusLabel: Record<string, string> = {
  invited: '招待中',
  active: '参加中',
  suspended: '停止中',
  removed: '解除済み',
};

export const CommunitySwitcher = ({ onNavigateHome }: Props) => {
  const {
    memberships,
    selectedCommunityId,
    selectedMembership,
    setSelectedCommunityId,
    loading,
  } = useSelectedCommunity();

  if (loading && memberships.length === 0) {
    return <p className={styles.hint}>コミュニティを読み込み中…</p>;
  }

  if (memberships.length === 0) {
    return (
      <p className={styles.hint}>
        所属コミュニティがありません。招待リンクから参加できます。
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="community-switcher">
        コミュニティ
      </label>
      <select
        id="community-switcher"
        className={styles.select}
        value={selectedCommunityId ?? ''}
        onChange={(e) => setSelectedCommunityId(e.target.value || null)}
      >
        {memberships.map((m) => (
          <option key={m.communityId} value={m.communityId}>
            {m.communityName}
            {m.status !== 'active' ? `（${statusLabel[m.status] ?? m.status}）` : ''}
          </option>
        ))}
      </select>
      {selectedMembership && (
        <div className={styles.meta}>
          {selectedMembership.communityNickname && (
            <span className={styles.nickname}>
              表示名: {selectedMembership.communityNickname}
            </span>
          )}
          <span className={styles.status}>
            {statusLabel[selectedMembership.status] ?? selectedMembership.status}
          </span>
        </div>
      )}
      {selectedCommunityId && onNavigateHome && (
        <button
          type="button"
          className={styles.homeButton}
          onClick={() => onNavigateHome(selectedCommunityId)}
        >
          コミュニティ HOME を開く
        </button>
      )}
    </div>
  );
};
