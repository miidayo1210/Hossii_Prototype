import { useState } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { nicknameInputAntiAutofillProps } from '../../core/utils/nicknameInputProps';
import { HOSSII_IDLE } from '../../core/assets/hossiiIdle';
import { normalizeSpaceNickname } from '../../core/utils/spaceNicknameRules';
import { isPlaceholderUsername } from '../../core/utils/spaceNicknameGate';
import styles from './NicknameModal.module.css';

type Props = {
  spaceId: string;
  onClose: () => void;
  /** ログイン済みで表示名未設定のときは profile、ゲスト入室時・参加ID初回は guest */
  variant?: 'guest' | 'profile';
};

function initialNicknameValue(params: {
  isProfileCompletion: boolean;
  spaceNickname?: string;
  defaultNickname?: string;
  username?: string;
  displayName?: string;
}): string {
  if (params.isProfileCompletion) {
    const candidates = [
      params.defaultNickname,
      params.username,
      params.displayName,
    ];
    for (const c of candidates) {
      const trimmed = c?.trim();
      if (trimmed && !isPlaceholderUsername(trimmed)) return trimmed;
    }
    return '';
  }

  const spaceNick = params.spaceNickname?.trim();
  if (spaceNick) return spaceNick;

  const defaultNick = params.defaultNickname?.trim();
  if (defaultNick && !isPlaceholderUsername(defaultNick)) return defaultNick;
  return '';
}

export const NicknameModal = ({ spaceId, onClose, variant = 'guest' }: Props) => {
  const { currentUser } = useAuth();
  const { state, setSpaceNickname, setDefaultNickname } = useHossiiStore();
  const { profile } = state;
  const isProfileCompletion = variant === 'profile';

  const space = state.spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name ?? 'スペース';
  const characterImageUrl = space?.characterImageUrl;
  const welcomeMessage = isProfileCompletion
    ? 'Hossiiで表示する名前を登録してください。\nこの名前はあとからアカウントページで変更できます。'
    : (space?.welcomeMessage ?? `「${spaceName}」にようこそ！ニックネームを入力してね。`);

  const [nickname, setNickname] = useState(() =>
    initialNicknameValue({
      isProfileCompletion,
      spaceNickname: state.spaceNicknames[spaceId],
      defaultNickname: profile?.defaultNickname,
      username: currentUser?.username,
      displayName: currentUser?.displayName ?? undefined,
    }),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (isSaving) return;

    const validated = normalizeSpaceNickname(nickname);
    if (!validated.ok) {
      setErrorMessage(
        validated.reason === 'too_long'
          ? 'ニックネームが長すぎます'
          : '使用できない文字が含まれています',
      );
      return;
    }
    if (!validated.value) return;

    const trimmed = validated.value;
    setErrorMessage(null);
    setIsSaving(true);

    try {
      if (isProfileCompletion) {
        setDefaultNickname(trimmed);
        if (!state.spaceNicknames[spaceId]?.trim()) {
          await setSpaceNickname(spaceId, trimmed);
        }
      } else {
        await setSpaceNickname(spaceId, trimmed);
      }
      onClose();
    } catch (error) {
      console.error('[NicknameModal] save failed', error);
      setErrorMessage('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {isProfileCompletion && (
          <p className={styles.profileTitle}>ログインできました</p>
        )}
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
          className={styles.input}
          placeholder={isProfileCompletion ? '表示名を入力' : 'ニックネームを入力'}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoFocus
          disabled={isSaving}
          maxLength={50}
          {...nicknameInputAntiAutofillProps}
        />
        {errorMessage && (
          <p className={styles.errorText} role="alert">{errorMessage}</p>
        )}
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => {
            void handleSave();
          }}
          disabled={!nickname.trim() || isSaving}
        >
          {isSaving ? '保存中…' : isProfileCompletion ? '登録する' : '決定'}
        </button>
      </div>
    </div>
  );
};
