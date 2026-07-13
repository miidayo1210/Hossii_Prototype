import { useCallback, useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import {
  createCommunityInvitation,
  fetchCommunityInvitations,
  revokeCommunityInvitation,
  buildInviteUrl,
  type CommunityInvitation,
} from '../../core/utils/communityInvitationsApi';
import styles from './CommunityAdminPanels.module.css';

type Props = {
  communityId: string;
};

export const CommunityInviteAdmin = ({ communityId }: Props) => {
  const [invites, setInvites] = useState<CommunityInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInvites(await fetchCommunityInvitations(communityId));
    } catch {
      setError('招待一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!email.trim() || acting) return;
    setActing(true);
    setError(null);
    setLastInviteUrl(null);
    const res = await createCommunityInvitation(communityId, email.trim());
    setActing(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const url = buildInviteUrl(res.data.inviteToken);
    setLastInviteUrl(url);
    setEmail('');
    await load();
  };

  const handleCopy = async () => {
    if (!lastInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('コピーに失敗しました。手動で選択してコピーしてください。');
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (acting) return;
    setActing(true);
    const res = await revokeCommunityInvitation(communityId, invitationId);
    setActing(false);
    if (!res.ok) setError(res.message);
    else await load();
  };

  if (loading) return <p className={styles.muted}>読み込み中…</p>;

  return (
    <div>
      <p className={styles.note}>
        現在はメール自動送信に未対応です。招待リンクをコピーして、本人へ共有してください。
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.inviteRow}>
        <input
          className={styles.input}
          type="email"
          placeholder="招待するメールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          className={styles.okBtn}
          disabled={acting || !email.trim()}
          onClick={() => void handleCreate()}
        >
          招待を作成
        </button>
      </div>
      {lastInviteUrl && (
        <div className={styles.urlBox}>
          <p className={styles.note}>
            招待URLを作成しました。メールは自動送信されていません。このリンクを本人へ共有してください。
          </p>
          <code className={styles.urlCode}>{lastInviteUrl}</code>
          <button type="button" className={styles.copyBtn} onClick={() => void handleCopy()}>
            <Copy size={14} /> {copied ? 'コピーしました' : 'リンクをコピー'}
          </button>
        </div>
      )}
      <ul className={styles.list}>
        {invites.map((inv) => (
          <li key={inv.invitationId} className={styles.row}>
            <div>
              <strong>{inv.inviteeEmail}</strong>
              <span className={styles.meta}>
                {inv.status} · 期限 {new Date(inv.expiresAt).toLocaleDateString('ja-JP')}
              </span>
            </div>
            {inv.status === 'pending' && (
              <button
                type="button"
                className={styles.warnBtn}
                disabled={acting}
                onClick={() => void handleRevoke(inv.invitationId)}
              >
                取り消し
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
