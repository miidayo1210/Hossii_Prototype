import { useState } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { nicknameInputAntiAutofillProps } from '../../core/utils/nicknameInputProps';
import { HOSSII_IDLE } from '../../core/assets/hossiiIdle';
import styles from './NicknameModal.module.css';

type Props = {
  spaceId: string;
  onClose: () => void;
  /** ログイン済みで表示名未設定のときは profile、ゲスト入室時は guest */
  variant?: 'guest' | 'profile';
};

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

  const [nickname, setNickname] = useState(() => {
    if (isProfileCompletion) {
      return (
        profile?.defaultNickname?.trim() ||
        currentUser?.username?.trim() ||
        currentUser?.displayName?.trim() ||
        ''
      );
    }
    return state.spaceNicknames[spaceId]?.trim() || profile?.defaultNickname?.trim() || '';
  });

  const handleSave = () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;

    if (isProfileCompletion) {
      setDefaultNickname(trimmed);
      if (!state.spaceNicknames[spaceId]?.trim()) {
        setSpaceNickname(spaceId, trimmed);
      }
    } else {
      setSpaceNickname(spaceId, trimmed);
    }
    onClose();
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
          {...nicknameInputAntiAutofillProps}
        />
        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={!nickname.trim()}
        >
          {isProfileCompletion ? '登録する' : '決定'}
        </button>
      </div>
    </div>
  );
};
