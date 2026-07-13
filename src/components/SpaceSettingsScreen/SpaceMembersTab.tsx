import { useCallback, useEffect, useState } from 'react';
import type { Space } from '../../core/types/space';
import type { SpaceMembershipStatus } from '../../core/types/spaceMembership';
import {
  fetchAdminSpaceMembers,
  fetchSpaceMemberCandidates,
  adminAddSpaceMember,
  adminSuspendSpaceMember,
  adminReactivateSpaceMember,
  adminRemoveSpaceMember,
  type AdminSpaceMember,
  type SpaceMemberCandidate,
} from '../../core/utils/spaceMembershipsApi';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import styles from './SpaceMembersTab.module.css';

type Props = {
  space: Space;
};

const statusLabel: Record<SpaceMembershipStatus, string> = {
  invited: '招待中',
  active: '参加中',
  suspended: '停止中',
  removed: '解除済み',
};

export const SpaceMembersTab = ({ space }: Props) => {
  const [members, setMembers] = useState<AdminSpaceMember[]>([]);
  const [candidates, setCandidates] = useState<SpaceMemberCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, c] = await Promise.all([
        fetchAdminSpaceMembers(space.id),
        fetchSpaceMemberCandidates(space.id),
      ]);
      setMembers(m);
      setCandidates(c);
      setSelectedCandidate(c[0]?.authUserId ?? '');
    } catch {
      setError('メンバー一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [space.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    if (!selectedCandidate || acting) return;
    setActing(true);
    const res = await adminAddSpaceMember(space.id, selectedCandidate);
    setActing(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    await load();
  };

  const runAction = async (
    fn: () => Promise<{ ok: boolean; message?: string }>,
  ) => {
    if (acting) return;
    setActing(true);
    const res = await fn();
    setActing(false);
    if (!res.ok) {
      setError(res.message ?? '操作に失敗しました');
      return;
    }
    await load();
  };

  return (
    <>
      <SettingsPageHeader
        title="スペースメンバー"
        description="招待制（invite_only）スペースに参加できるメンバーを管理します。コミュニティメンバーから追加してください。"
      >
        <SettingsSection title="メンバーを追加">
          {candidates.length === 0 ? (
            <p className={styles.note}>追加可能なコミュニティメンバーがいません。</p>
          ) : (
            <div className={styles.addRow}>
              <select
                className={styles.select}
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
              >
                <option value="">選択してください</option>
                {candidates.map((c) => (
                  <option key={c.authUserId} value={c.authUserId}>
                    {c.displayName}
                  </option>
                ))}
              </select>
              <button type="button" className={styles.btn} disabled={acting || !selectedCandidate} onClick={() => void handleAdd()}>
                追加
              </button>
            </div>
          )}
        </SettingsSection>

        <SettingsSection title="メンバー一覧">
          {loading && <p className={styles.note}>読み込み中…</p>}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && members.length === 0 && (
            <p className={styles.note}>まだメンバーがいません。</p>
          )}
          {!loading && members.length > 0 && (
            <ul className={styles.list}>
              {members.map((m) => (
                <li key={m.membershipId} className={styles.item}>
                  <div className={styles.itemMain}>
                    <span className={styles.name}>{m.displayName}</span>
                    <span className={styles.sub}>
                      {statusLabel[m.status]}
                      {m.spaceNickname ? ` · ${m.spaceNickname}` : ''}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    {m.status === 'active' && (
                      <button
                        type="button"
                        className={styles.btnSubtle}
                        disabled={acting}
                        onClick={() => void runAction(() => adminSuspendSpaceMember(space.id, m.membershipId))}
                      >
                        停止
                      </button>
                    )}
                    {(m.status === 'suspended' || m.status === 'removed') && (
                      <button
                        type="button"
                        className={styles.btnSubtle}
                        disabled={acting}
                        onClick={() => void runAction(() => adminReactivateSpaceMember(space.id, m.membershipId))}
                      >
                        復帰
                      </button>
                    )}
                    {(m.status === 'active' || m.status === 'suspended') && (
                      <button
                        type="button"
                        className={styles.btnDanger}
                        disabled={acting}
                        onClick={() => void runAction(() => adminRemoveSpaceMember(space.id, m.membershipId))}
                      >
                        解除
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      </SettingsPageHeader>
    </>
  );
};
