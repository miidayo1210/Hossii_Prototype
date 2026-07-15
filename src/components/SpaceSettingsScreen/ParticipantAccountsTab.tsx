import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import type { Space } from '../../core/types/space';
import {
  buildParticipantAccountRows,
  fetchParticipantAccounts,
  issueParticipantAccount,
  regenerateParticipantPassword,
  revokeParticipantAccount,
  type ParticipantAccount,
} from '../../core/utils/participantAccountsApi';
import { SettingsPageHeader } from './SettingsPageHeader';
import sharedStyles from './SettingsShared.module.css';
import styles from './ParticipantAccountsTab.module.css';

type Props = {
  space: Space;
};

type CredentialModal = {
  loginId: string;
  password: string;
  slotNumber: number;
  mode: 'issue' | 'regenerate';
};

function accountStatusLabel(account: ParticipantAccount | null): string {
  if (!account) return '未発行';
  if (!account.firstLoginAt) return '初回未使用';
  return '利用中';
}

export const ParticipantAccountsTab = ({ space }: Props) => {
  const [accounts, setAccounts] = useState<ParticipantAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [credentialModal, setCredentialModal] = useState<CredentialModal | null>(null);
  const [linkCommunityMembership, setLinkCommunityMembership] = useState(false);
  const [linkSpaceMembership, setLinkSpaceMembership] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchParticipantAccounts(space.id);
    setAccounts(rows);
    setLoading(false);
  }, [space.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = buildParticipantAccountRows(accounts);
  const issuedCount = accounts.length;

  const showError = (message: string) => {
    setErrorMsg(message);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const handleIssue = async (slotNumber: number) => {
    setBusySlot(slotNumber);
    setErrorMsg('');
    try {
      const result = await issueParticipantAccount(space.id, slotNumber, {
        linkCommunityMembership,
        linkSpaceMembership,
      });
      setCredentialModal({
        loginId: result.loginId,
        password: result.password,
        slotNumber: result.slotNumber,
        mode: 'issue',
      });
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : '発行に失敗しました');
    } finally {
      setBusySlot(null);
    }
  };

  const handleRegenerate = async (slotNumber: number) => {
    setBusySlot(slotNumber);
    setErrorMsg('');
    try {
      const result = await regenerateParticipantPassword(space.id, slotNumber);
      setCredentialModal({
        loginId: result.loginId,
        password: result.password,
        slotNumber: result.slotNumber,
        mode: 'regenerate',
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'パスワード再発行に失敗しました');
    } finally {
      setBusySlot(null);
    }
  };

  const handleRevoke = async (slotNumber: number) => {
    if (!window.confirm(`スロット #${slotNumber} の参加者アカウントを無効化しますか？`)) {
      return;
    }
    setBusySlot(slotNumber);
    setErrorMsg('');
    try {
      await revokeParticipantAccount(space.id, slotNumber);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : '無効化に失敗しました');
    } finally {
      setBusySlot(null);
    }
  };

  const copyCredentials = async () => {
    if (!credentialModal) return;
    const text = `参加 ID: ${credentialModal.loginId}\nパスワード: ${credentialModal.password}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      showError('コピーに失敗しました');
    }
  };

  return (
    <div className={sharedStyles.page}>
      <SettingsPageHeader
        title="参加者アカウント"
        description="このスペース専用のログイン ID を最大 20 件まで発行できます。参加者に ID とパスワードを共有してください。"
      >
      <p className={styles.summary}>
        発行済み: <strong>{issuedCount}</strong> / 20
      </p>
      <div className={styles.linkOptions}>
        <p className={styles.optionIntro}>
          発行時に、利用者をコミュニティやスペースのメンバーとして自動登録できます。public
          スペースだけを使わせる場合は、どちらも OFF で利用できます。
        </p>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={linkCommunityMembership}
            onChange={(e) => setLinkCommunityMembership(e.target.checked)}
          />
          <span className={styles.checkText}>
            <span className={styles.checkTitle}>コミュニティにも所属させる</span>
            <span className={styles.checkDesc}>
              この ID の利用者を、スペースが属するコミュニティのメンバーとして登録します。コミュニティ
              HOME や個人スペースを利用させたい場合に選択してください。
            </span>
          </span>
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={linkSpaceMembership}
            onChange={(e) => setLinkSpaceMembership(e.target.checked)}
          />
          <span className={styles.checkText}>
            <span className={styles.checkTitle}>このスペースのメンバーにも登録する</span>
            <span className={styles.checkDesc}>
              この ID の利用者を、このスペースのメンバーとして登録します。メンバー限定スペースへ入れる場合に選択してください。
            </span>
          </span>
        </label>
        {linkSpaceMembership && !linkCommunityMembership && (
          <p className={styles.optionNote}>
            コミュニティ所属なしでスペースメンバーのみ登録できます。メンバー限定スペースには入れますが、コミュニティ
            HOME や個人スペースは利用できません。
          </p>
        )}
      </div>

      {errorMsg && <p className={styles.error}>{errorMsg}</p>}

      {loading ? (
        <p className={styles.loading}>読み込み中…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>参加 ID</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((account, index) => {
                const slotNumber = index + 1;
                const isBusy = busySlot === slotNumber;
                return (
                  <tr key={slotNumber}>
                    <td>{slotNumber}</td>
                    <td>{account?.loginId ?? '—'}</td>
                    <td>{accountStatusLabel(account)}</td>
                    <td>
                      <div className={styles.actions}>
                        {!account ? (
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => void handleIssue(slotNumber)}
                            disabled={isBusy || issuedCount >= 20}
                          >
                            <Plus size={14} />
                            発行
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() =>
                                setCredentialModal({
                                  loginId: account.loginId,
                                  password: '',
                                  slotNumber,
                                  mode: 'issue',
                                })
                              }
                              disabled={isBusy}
                            >
                              再表示
                            </button>
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => void handleRegenerate(slotNumber)}
                              disabled={isBusy}
                            >
                              <KeyRound size={14} />
                              再発行
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.dangerButton}`}
                              onClick={() => void handleRevoke(slotNumber)}
                              disabled={isBusy}
                            >
                              <Trash2 size={14} />
                              無効化
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {credentialModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>
              {credentialModal.password
                ? credentialModal.mode === 'regenerate'
                  ? 'パスワードを再発行しました'
                  : '参加者アカウントを発行しました'
                : '参加 ID'}
            </h3>
            <dl className={styles.credentials}>
              <div>
                <dt>参加 ID</dt>
                <dd>{credentialModal.loginId}</dd>
              </div>
              {credentialModal.password && (
                <div>
                  <dt>パスワード</dt>
                  <dd className={styles.password}>{credentialModal.password}</dd>
                </div>
              )}
            </dl>
            {credentialModal.password ? (
              <p className={styles.modalNote}>
                パスワードはこの画面でのみ表示されます。参加者に安全な方法で共有してください。
              </p>
            ) : (
              <p className={styles.modalNote}>
                セキュリティのため、パスワードは再表示できません。必要な場合は「パスワード再発行」を使ってください。
              </p>
            )}
            <div className={styles.modalActions}>
              {credentialModal.password && (
                <button type="button" className={styles.primaryButton} onClick={() => void copyCredentials()}>
                  <Copy size={14} />
                  コピー
                </button>
              )}
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setCredentialModal(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      </SettingsPageHeader>
    </div>
  );
};
