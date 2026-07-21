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

const NICKNAME_PROMPT = `このスペースで、
なんて呼ばれたい？`;

const NICKNAME_MAX_LENGTH = 10;

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
  const [isJoining, setIsJoining] = useState(false);

  const space = state.spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name ?? 'スペース';
  const participationIntroMessage = getParticipationIntroMessage(space);
  const trimmedNickname = nickname.trim();
  const canJoin = trimmedNickname.length > 0;

  const nicknameSpeechText = canJoin
    ? `${trimmedNickname}さんだね！\n準備できたよ`
    : NICKNAME_PROMPT;

  const handleGuestEnter = () => {
    const trimmed = nickname.trim();
    if (!trimmed || isJoining) return;
    setIsJoining(true);
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
            <button
              type="button"
              className={styles.stepBackButton}
              onClick={() => setStep('select')}
            >
              ← 戻る
            </button>

            <div className={styles.selectHeader}>
              <h1 className={styles.logo}>✨ Hossii</h1>
              <p className={styles.selectSpaceName}>{spaceName}</p>
            </div>

            <div className={styles.nicknameHossiiArea}>
              <img
                key={canJoin ? 'smile' : 'base'}
                src={canJoin ? HOSSII_IDLE.smile : HOSSII_IDLE.base}
                alt="Hossii"
                className={styles.nicknameHossiiImage}
              />
            </div>

            <div className={styles.speechBubble}>
              <p className={styles.speechText}>{nicknameSpeechText}</p>
            </div>

            <div className={styles.nicknameForm}>
              <label className={styles.nicknameFieldLabel} htmlFor="guest-nickname-input">
                ニックネーム
              </label>
              <input
                id="guest-nickname-input"
                type="text"
                className={styles.nicknameInput}
                placeholder="ニックネームを入力"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={NICKNAME_MAX_LENGTH}
                autoFocus
                enterKeyHint="done"
                {...nicknameInputAntiAutofillProps}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (canJoin && !isJoining) handleGuestEnter();
                }}
              />
              <p className={styles.nicknameCharCount} aria-live="polite">
                {nickname.length} / {NICKNAME_MAX_LENGTH}
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleGuestEnter}
                disabled={!canJoin || isJoining}
                aria-disabled={!canJoin || isJoining}
              >
                {isJoining ? '参加しています…' : '参加する'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
