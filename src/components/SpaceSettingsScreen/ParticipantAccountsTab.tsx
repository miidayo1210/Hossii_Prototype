import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import type { Space } from '../../core/types/space';
import {
  buildParticipantAccountRows,
  fetchParticipantAccountManagementSnapshot,
  formatParticipantCredentialsForCopy,
  getAvailableParticipantSlots,
  isParticipantSlotOccupied,
  issueParticipantAccount,
  issueParticipantAccountsBulk,
  MAX_PARTICIPANT_ACCOUNT_SLOTS,
  regenerateParticipantPassword,
  revokeParticipantAccount,
  validateBulkIssueCount,
  type ParticipantAccount,
  type ParticipantAccountIssueResult,
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

const DEFAULT_BULK_COUNT = 10;

function accountStatusLabel(
  account: ParticipantAccount | null,
  slotOccupied: boolean,
): string {
  if (account) {
    if (!account.firstLoginAt) return '初回未使用';
    return '利用中';
  }
  if (slotOccupied) return '無効化済み';
  return '未発行';
}

export const ParticipantAccountsTab = ({ space }: Props) => {
  const [accounts, setAccounts] = useState<ParticipantAccount[]>([]);
  const [occupiedSlotNumbers, setOccupiedSlotNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [bulkCountInput, setBulkCountInput] = useState(String(DEFAULT_BULK_COUNT));
  const [recentlyIssued, setRecentlyIssued] = useState<ParticipantAccountIssueResult[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [credentialModal, setCredentialModal] = useState<CredentialModal | null>(null);
  const [linkCommunityMembership, setLinkCommunityMembership] = useState(false);
  const [linkSpaceMembership, setLinkSpaceMembership] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const snapshot = await fetchParticipantAccountManagementSnapshot(space.id);
    setAccounts(snapshot.activeAccounts);
    setOccupiedSlotNumbers(snapshot.occupiedSlotNumbers);
    setLoading(false);
  }, [space.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = buildParticipantAccountRows(accounts);
  const activeAccountCount = accounts.length;
  const availableSlots = getAvailableParticipantSlots(occupiedSlotNumbers);
  const availableCount = availableSlots.length;
  const isFullyIssued = availableCount === 0;

  const parsedBulkCount = Number.parseInt(bulkCountInput, 10);
  const bulkCountValidation = validateBulkIssueCount(parsedBulkCount, availableCount);
  const bulkCountValid = bulkCountValidation === null;

  useEffect(() => {
    if (availableCount <= 0) return;
    const clamped = Math.min(DEFAULT_BULK_COUNT, availableCount);
    setBulkCountInput(String(clamped));
  }, [availableCount]);

  const showError = (message: string) => {
    setErrorMsg(message);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showCopyFeedback = (message: string) => {
    setCopyFeedback(message);
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  const membershipOptions = {
    linkCommunityMembership,
    linkSpaceMembership,
  };

  const handleIssue = async (slotNumber: number) => {
    setBusySlot(slotNumber);
    setErrorMsg('');
    try {
      const result = await issueParticipantAccount(space.id, slotNumber, membershipOptions);
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

  const handleBulkIssue = async () => {
    if (bulkIssuing || isFullyIssued || !bulkCountValid) return;

    setBulkIssuing(true);
    setErrorMsg('');
    setSuccessMsg('');
    setCopyFeedback('');

    try {
      const result = await issueParticipantAccountsBulk(
        space.id,
        parsedBulkCount,
        membershipOptions,
      );

      setRecentlyIssued(result.issued);
      await reload();

      if (result.partial && result.error) {
        showError(`${result.count} 件発行しましたが、途中で失敗しました: ${result.error}`);
      } else {
        showSuccess(`${result.count} 件のアカウントを発行しました`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '一括発行に失敗しました');
    } finally {
      setBulkIssuing(false);
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

  const copyRecentlyIssued = async () => {
    if (recentlyIssued.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatParticipantCredentialsForCopy(recentlyIssued));
      showCopyFeedback('今回発行したアカウントをコピーしました');
    } catch {
      showError('コピーに失敗しました');
    }
  };

  return (
    <div className={sharedStyles.page}>
      <SettingsPageHeader
        title="参加者アカウント"
        description={`このスペース専用のログイン ID を最大 ${MAX_PARTICIPANT_ACCOUNT_SLOTS} 件まで発行できます。参加者に ID とパスワードを共有してください。`}
      >
      <p className={styles.summary}>
        利用可能アカウント: <strong>{activeAccountCount}</strong> 件
        {' · '}
        新規発行可能: <strong>{availableCount}</strong> 件
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

      <div className={styles.bulkIssue}>
        <div className={styles.bulkIssueHeader}>
          <h3 className={styles.bulkIssueTitle}>まとめて発行</h3>
          <p className={styles.bulkIssueDesc}>
            新規発行可能な slot の小さい番号から順に、指定件数を一括発行します。
          </p>
        </div>
        <div className={styles.bulkIssueControls}>
          <label className={styles.bulkCountLabel}>
            発行件数
            <input
              type="number"
              className={styles.bulkCountInput}
              min={1}
              max={Math.max(availableCount, 1)}
              inputMode="numeric"
              value={bulkCountInput}
              onChange={(e) => setBulkCountInput(e.target.value)}
              disabled={isFullyIssued || bulkIssuing || loading}
            />
          </label>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleBulkIssue()}
            disabled={isFullyIssued || bulkIssuing || loading || !bulkCountValid}
          >
            <Plus size={14} />
            {bulkIssuing ? '発行中…' : 'まとめて発行'}
          </button>
        </div>
        {!loading && bulkCountInput !== '' && bulkCountValidation && (
          <p className={styles.bulkValidation}>{bulkCountValidation}</p>
        )}
        {successMsg && <p className={styles.success}>{successMsg}</p>}
      </div>

      {recentlyIssued.length > 0 && (
        <div className={styles.recentlyIssued}>
          <p className={styles.recentlyIssuedTitle}>
            今回発行したアカウント: <strong>{recentlyIssued.length}</strong> 件
          </p>
          <p className={styles.recentlyIssuedNote}>
            パスワードはこの画面でのみ表示できます。画面を閉じると再表示できません。必要な場合は「パスワード再発行」を使ってください。
          </p>
          <div className={styles.recentlyIssuedActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void copyRecentlyIssued()}
            >
              <Copy size={14} />
              今回発行したアカウントをすべてコピー
            </button>
            {copyFeedback && <span className={styles.copyFeedback}>{copyFeedback}</span>}
          </div>
        </div>
      )}

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
                const slotOccupied = isParticipantSlotOccupied(slotNumber, occupiedSlotNumbers);
                const canIssue = !account && !slotOccupied && !isFullyIssued;
                return (
                  <tr key={slotNumber}>
                    <td>{slotNumber}</td>
                    <td>{account?.loginId ?? '—'}</td>
                    <td>{accountStatusLabel(account, slotOccupied)}</td>
                    <td>
                      <div className={styles.actions}>
                        {canIssue ? (
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => void handleIssue(slotNumber)}
                            disabled={isBusy || bulkIssuing}
                          >
                            <Plus size={14} />
                            発行
                          </button>
                        ) : account ? (
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
                              disabled={isBusy || bulkIssuing}
                            >
                              再表示
                            </button>
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => void handleRegenerate(slotNumber)}
                              disabled={isBusy || bulkIssuing}
                            >
                              <KeyRound size={14} />
                              再発行
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.dangerButton}`}
                              onClick={() => void handleRevoke(slotNumber)}
                              disabled={isBusy || bulkIssuing}
                            >
                              <Trash2 size={14} />
                              無効化
                            </button>
                          </>
                        ) : null}
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
