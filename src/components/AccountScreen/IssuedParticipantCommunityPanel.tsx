import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import styles from '../Community/CommunitySwitcher.module.css';

/**
 * 参加IDアカウント向け: 発行元コミュニティ 1 件を固定表示する。
 * 切替 UI（select）は出さない。
 */
export const IssuedParticipantCommunityPanel = () => {
  const { selectedMembership, memberships, loading } = useSelectedCommunity();

  if (loading && memberships.length === 0) {
    return <p className={styles.hint}>コミュニティを読み込み中…</p>;
  }

  if (!selectedMembership) {
    return (
      <p className={styles.hint}>
        発行元コミュニティを表示できませんでした。時間をおいて再度お試しください。
      </p>
    );
  }

return (
    <div className={styles.wrap} data-testid="issued-participant-community">
      <p className={styles.label}>コミュニティ</p>
      <div className={styles.meta}>
        <span className={styles.nickname}>{selectedMembership.communityName}</span>
        <span className={styles.status}>参加中</span>
      </div>
    </div>
  );
};
