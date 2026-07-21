import { useState } from 'react';
import { nicknameInputAntiAutofillProps } from '../../core/utils/nicknameInputProps';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { HOSSII_IDLE } from '../../core/assets/hossiiIdle';
import type { Space } from '../../core/types/space';
import styles from './GuestEntryScreen.module.css';

type Step = 'select' | 'nickname';

const DEFAULT_PARTICIPATION_INTRO = `こんにちは！
ここは、みんなの気づきや想いを
自由に残せるスペースだよ`;

function getParticipationIntroMessage(space: Space | undefined): string {
  const welcome = space?.welcomeMessage?.trim();
  if (welcome) return welcome;
  const description = space?.description?.trim();
  if (description) return description;
  return DEFAULT_PARTICIPATION_INTRO;
}

type Props = {
  spaceId: string;
  onEnterAsGuest: () => void;
  /** 参加者ログイン導線 */
  onLoginRequested?: () => void;
  /** 将来の新規登録導線用（現状は Coming soon のため未使用） */
  onSignUpRequested?: () => void;
};

export const GuestEntryScreen = ({ spaceId, onEnterAsGuest, onLoginRequested }: Props) => {
  const { state, setSpaceNickname } = useHossiiStore();
  const [step, setStep] = useState<Step>('select');
  // スペース固有ニックネーム → デフォルトニックネーム → 空文字 の優先順で初期値を設定
  const savedNickname = state.spaceNicknames[spaceId] ?? state.profile?.defaultNickname ?? '';
  const [nickname, setNickname] = useState(savedNickname);

  const space = state.spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name ?? 'スペース';
  const characterImageUrl = space?.characterImageUrl;
  const participationIntroMessage = getParticipationIntroMessage(space);

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
        {step === 'select' && (
          <>
            <div className={styles.selectHeader}>
              <h1 className={styles.logo}>✨ Hossii</h1>
              <p className={styles.selectSpaceName}>{spaceName}</p>
            </div>

            <div className={styles.selectHossiiArea}>
              <img
                src={HOSSII_IDLE.base}
                alt="Hossii"
                className={styles.selectHossiiImage}
              />
            </div>

            <div className={styles.speechBubble}>
              <p className={styles.speechText}>{participationIntroMessage}</p>
              <p className={styles.speechPrompt}>どの方法で参加する？</p>
            </div>

            <div className={styles.participationOptions}>
              <button
                type="button"
                className={`${styles.participationCard} ${styles.participationCardGuest}`}
                onClick={() => setStep('nickname')}
              >
                <span className={styles.participationCardTitle}>ゲストとして参加</span>
                <span className={styles.participationCardDesc}>ニックネームだけで参加できます</span>
              </button>
              <button
                type="button"
                className={styles.participationCard}
                onClick={() => onLoginRequested?.()}
              >
                <span className={styles.participationCardTitle}>アカウントで参加</span>
                <span className={styles.participationCardDesc}>参加した情報を引き継げます</span>
              </button>
            </div>
          </>
        )}

        {step === 'nickname' && (
          <>
            <div className={styles.header}>
              <h1 className={styles.logo}>✨ Hossii</h1>
              <p className={styles.spaceName}>「{spaceName}」に参加する</p>
              <p className={styles.subtitle}>参加方法を選んでください</p>
            </div>
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
                  <p className={styles.speechText}>ゲストとして参加する名前を入力してください</p>
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
                {...nicknameInputAntiAutofillProps}
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
          </>
        )}
      </div>
    </div>
  );
};
