import { useState } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import styles from './GuestEntryScreen.module.css';

type Step = 'select' | 'nickname';

type Props = {
  spaceId: string;
  onEnterAsGuest: () => void;
  onLoginRequested: () => void;
};

export const GuestEntryScreen = ({ spaceId, onEnterAsGuest, onLoginRequested }: Props) => {
  const { state, setSpaceNickname } = useHossiiStore();
  const [step, setStep] = useState<Step>('select');
  const [nickname, setNickname] = useState(state.profile?.defaultNickname ?? '');

  const spaceName = state.spaces.find((s) => s.id === spaceId)?.name ?? 'スペース';

  const handleGuestEnter = () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    setSpaceNickname(spaceId, trimmed);
    onEnterAsGuest();
  };

  return (
    <div className={styles.container}>
      <div className={styles.stars} />
      <div className={styles.stars2} />
      <div className={styles.stars3} />

      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>✨ Hossii</h1>
          <p className={styles.spaceName}>「{spaceName}」に参加する</p>
        </div>

        {step === 'select' && (
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setStep('nickname')}
            >
              ゲストとして参加
            </button>
            <p className={styles.guestNote}>ニックネームだけで参加できます</p>

            <div className={styles.divider}>
              <span className={styles.dividerText}>または</span>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onLoginRequested}
            >
              アカウントでログイン
            </button>
            <p className={styles.loginNote}>過去ログの閲覧が可能になります</p>
          </div>
        )}

        {step === 'nickname' && (
          <div className={styles.nicknameForm}>
            <p className={styles.nicknameLabel}>このスペースで使う名前</p>
            <input
              type="text"
              className={styles.nicknameInput}
              placeholder="ニックネームを入力"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGuestEnter();
              }}
            />
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleGuestEnter}
              disabled={!nickname.trim()}
            >
              入室する
            </button>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => setStep('select')}
            >
              戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
