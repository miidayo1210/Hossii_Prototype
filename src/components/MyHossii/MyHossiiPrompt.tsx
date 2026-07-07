import { useState } from 'react';
import { dismissMyHossiiPrompt, isMyHossiiPromptDismissed } from '../../core/utils/myHossiiPromptStorage';
import styles from './MyHossiiPrompt.module.css';

type Props = {
  userId: string;
  spaceId: string;
};

export const MyHossiiPrompt = ({ userId, spaceId }: Props) => {
  const [dismissed, setDismissed] = useState(() => isMyHossiiPromptDismissed(userId, spaceId));

  if (dismissed) return null;

  const handleSkip = () => {
    dismissMyHossiiPrompt(userId, spaceId);
    setDismissed(true);
  };

  const handleGoAccount = () => {
    dismissMyHossiiPrompt(userId, spaceId);
    setDismissed(true);
    window.location.hash = '#account';
  };

  return (
    <div className={styles.prompt} role="status">
      <p className={styles.title}>マイHossiiを選ぼう</p>
      <p className={styles.body}>あなたのHossiiを登録すると、このスペースに登場します。</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={handleGoAccount}>
          選びにいく
        </button>
        <button type="button" className={styles.skipButton} onClick={handleSkip}>
          スキップ
        </button>
      </div>
    </div>
  );
};
