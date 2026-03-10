import { useState } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { HOSSII_IDLE } from '../../core/assets/hossiiIdle';
import styles from './NicknameModal.module.css';

type Props = {
  spaceId: string;
  onClose: () => void;
};

export const NicknameModal = ({ spaceId, onClose }: Props) => {
  const { state, setSpaceNickname } = useHossiiStore();
  const { profile } = state;

  const space = state.spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name ?? 'スペース';
  const characterImageUrl = space?.characterImageUrl;
  const welcomeMessage = space?.welcomeMessage ?? `「${spaceName}」にようこそ！ニックネームを入力してね。`;

  const [nickname, setNickname] = useState(profile?.defaultNickname || '');

  const handleSave = () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;

    setSpaceNickname(spaceId, trimmed);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
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
          placeholder="ニックネームを入力"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoFocus
          autoComplete="new-password"
        />
        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={!nickname.trim()}
        >
          決定
        </button>
      </div>
    </div>
  );
};
