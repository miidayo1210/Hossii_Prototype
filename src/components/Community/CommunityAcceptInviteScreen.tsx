import { useState } from 'react';
import { useRouter } from '../../core/hooks/useRouter';
import { useAuth } from '../../core/contexts/useAuth';
import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import { acceptCommunityInvitation } from '../../core/utils/communityInvitationsApi';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import styles from './CommunityAcceptInviteScreen.module.css';

type Props = {
  inviteToken: string;
};

export const CommunityAcceptInviteScreen = ({ inviteToken }: Props) => {
  const { currentUser } = useAuth();
  const { refreshMemberships, setSelectedCommunityId } = useSelectedCommunity();
  const { navigate } = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!currentUser || status === 'loading') return;
    setStatus('loading');
    const res = await acceptCommunityInvitation(inviteToken);
    if (!res.ok) {
      setStatus('error');
      setMessage('招待を受け付けられませんでした。リンクの有効期限、メールアドレス、ログイン状態をご確認ください。');
      return;
    }
    setStatus('ok');
    setMessage(`${res.data.communityName} に参加しました。`);
    setSelectedCommunityId(res.data.communityId);
    await refreshMemberships();
    setTimeout(() => navigate('community', res.data.communityId), 1200);
  };

  return (
    <div className={styles.page}>
      <TopRightMenu />
      <div className={styles.card}>
        <h1 className={styles.title}>コミュニティ招待</h1>
        {!currentUser ? (
          <p className={styles.text}>
            招待を受け入れるには、招待されたメールアドレスでログインしてください。
          </p>
        ) : (
          <>
            <p className={styles.text}>
              ログイン中: {currentUser.email ?? '（メール未設定）'}
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={status === 'loading' || status === 'ok'}
              onClick={() => void handleAccept()}
            >
              {status === 'loading' ? '処理中…' : '招待を受け入れる'}
            </button>
          </>
        )}
        {message && (
          <p className={status === 'error' ? styles.error : styles.ok}>{message}</p>
        )}
      </div>
    </div>
  );
};
