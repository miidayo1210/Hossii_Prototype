import { useState } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { HOSSII_IDLE } from '../../core/assets/hossiiIdle';
import styles from './GuestEntryScreen.module.css';

type Step = 'select' | 'nickname';

type Props = {
  spaceId: string;
  onEnterAsGuest: () => void;
  onLoginRequested: () => void;
  onSignUpRequested: () => void;
};

export const GuestEntryScreen = ({ spaceId, onEnterAsGuest, onLoginRequested, onSignUpRequested }: Props) => {
  const { state, setSpaceNickname } = useHossiiStore();
  const [step, setStep] = useState<Step>('select');
  // スペース固有ニックネーム → デフォルトニックネーム → 空文字 の優先順で初期値を設定
  const savedNickname = state.spaceNicknames[spaceId] ?? state.profile?.defaultNickname ?? '';
  const [nickname, setNickname] = useState(savedNickname);

  const space = state.spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name ?? 'スペース';
  const characterImageUrl = space?.characterImageUrl;
  const welcomeMessage = space?.welcomeMessage ?? `「${spaceName}」にようこそ！ニックネームを入力してね。`;

  const handleGuestEnter = () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    setSpaceNickname(spaceId, trimmed);
    onEnterAsGuest();
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />

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
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.comingSoonButton}`}
              disabled
            >
              アカウントでログイン
              <span className={styles.comingSoonBadge}>Coming Soon</span>
            </button>
            <button
              type="button"
              className={`${styles.signUpLink} ${styles.comingSoonLink}`}
              disabled
            >
              新規登録の方はこちら
              <span className={styles.comingSoonBadge}>Coming Soon</span>
            </button>
          </div>
        )}

        {step === 'nickname' && (
          <div className={styles.nicknameForm}>
            <div className={styles.welcomeArea}>
              <div className={styles.characterIcon}>
                <img
                  src={characterImageUrl ?? (nickname.trim() ? HOSSII_IDLE.smile : HOSSII_IDLE.base)}
                  alt="Hossiiキャラ"
                  className={styles.characterImage}
                />
              </div>
              <div className={styles.speechBubble}>
                <p className={styles.speechText}>{welcomeMessage}</p>
              </div>
            </div>
            <input
              type="text"
              className={styles.nicknameInput}
              placeholder="ニックネームを入力"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              autoFocus
              autoComplete="new-password"
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
