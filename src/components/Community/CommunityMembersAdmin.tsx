import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminCommunityMembers,
  adminSuspendCommunityMember,
  adminReactivateCommunityMember,
  adminRemoveCommunityMember,
  type AdminCommunityMember,
} from '../../core/utils/communityInvitationsApi';
import type { CommunityMembershipStatus } from '../../core/types/communityMembership';
import styles from './CommunityAdminPanels.module.css';

const statusLabel: Record<CommunityMembershipStatus, string> = {
  invited: '招待中',
  active: '参加中',
  suspended: '停止中',
  removed: '解除済み',
};

type Props = {
  communityId: string;
};

export const CommunityMembersAdmin = ({ communityId }: Props) => {
  const [members, setMembers] = useState<AdminCommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await fetchAdminCommunityMembers(communityId));
    } catch {
      setError('メンバー一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    confirmMessage?: string,
  ) => {
    if (acting) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setActing(true);
    const res = await fn();
    setActing(false);
    if (!res.ok) {
      setError(res.message ?? '操作に失敗しました');
      return;
    }
    await load();
  };

  if (loading) return <p className={styles.muted}>読み込み中…</p>;

  return (
    <div>
      <p className={styles.note}>
        メンバーの停止・復帰・解除は、コミュニティ限定スペースと個人スペースへのアクセスに影響します。public
        スペースは引き続き利用できます。
      </p>
      {error && <p className={styles.error}>{error}</p>}
      {members.length === 0 ? (
        <p className={styles.muted}>メンバーがいません。</p>
      ) : (
        <ul className={styles.list}>
          {members.map((m) => (
            <li key={m.membershipId} className={styles.row}>
              <div>
                <strong>{m.displayName}</strong>
                <span className={styles.meta}>
                  {m.role} · {statusLabel[m.status]}
                </span>
              </div>
              <div className={styles.actions}>
                {m.status === 'active' && (
                  <button
                    type="button"
                    className={styles.warnBtn}
                    disabled={acting}
                    title="コミュニティ限定スペースと個人スペースへのアクセスを一時停止します。publicスペースは引き続き利用できます。"
                    onClick={() =>
                      void run(
                        () => adminSuspendCommunityMember(communityId, m.membershipId),
                        `${m.displayName} を一時停止しますか？\nコミュニティ限定スペースと個人スペースへのアクセスを一時停止します。publicスペースは引き続き利用できます。`,
                      )
                    }
                  >
                    停止
                  </button>
                )}
                {(m.status === 'suspended' || m.status === 'removed') && (
                  <button
                    type="button"
                    className={styles.okBtn}
                    disabled={acting}
                    onClick={() =>
                      void run(() => adminReactivateCommunityMember(communityId, m.membershipId))
                    }
                  >
                    復帰
                  </button>
                )}
                {m.status !== 'removed' && (
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={acting}
                    title="コミュニティへの所属を解除します。アカウントや過去の投稿は削除されません。"
                    onClick={() =>
                      void run(
                        () => adminRemoveCommunityMember(communityId, m.membershipId),
                        `${m.displayName} の所属を解除しますか？\nコミュニティへの所属を解除します。アカウントや過去の投稿は削除されません。`,
                      )
                    }
                  >
                    解除
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
