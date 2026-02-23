import { useState } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import styles from './NicknameModal.module.css';

type Props = {
  spaceId: string;
  onClose: () => void;
};

export const NicknameModal = ({ spaceId, onClose }: Props) => {
  const { state, setSpaceNickname } = useHossiiStore();
  const { profile } = state;

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
        <h2 className={styles.title}>このスペースでのニックネーム</h2>
        <p className={styles.description}>
          このスペースで使う表示名を入力してください
        </p>
        <input
          type="text"
          className={styles.input}
          placeholder="ニックネームを入力"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoFocus
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
