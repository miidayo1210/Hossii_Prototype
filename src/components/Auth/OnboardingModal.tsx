import { useState } from 'react';
import { User, AtSign } from 'lucide-react';
import styles from './OnboardingModal.module.css';

type Props = {
  onComplete: (userId: string, nickname: string) => void;
};

export const OnboardingModal = ({ onComplete }: Props) => {
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateUserId = (id: string): boolean => {
    // 英数字のみ、3-20文字
    const regex = /^[a-zA-Z0-9]{3,20}$/;
    return regex.test(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!validateUserId(userId)) {
      setError('ユーザーIDは英数字3〜20文字で入力してください');
      return;
    }

    if (nickname.trim().length < 1 || nickname.trim().length > 30) {
      setError('ニックネームは1〜30文字で入力してください');
      return;
    }

    setLoading(true);

    try {
      // TODO: Check if userId is already taken (implement with Firestore)
      // For now, just complete the onboarding
      onComplete(userId.toLowerCase(), nickname.trim());
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('プロフィール登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <span className={styles.icon}>✨</span>
          </div>
          <h2 className={styles.title}>プロフィール設定</h2>
          <p className={styles.subtitle}>
            あなたのプロフィールを設定してください
          </p>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              <AtSign size={16} className={styles.labelIcon} />
              <span>ユーザーID</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="英数字3〜20文字"
              value={userId}
              onChange={(e) => setUserId(e.target.value.toLowerCase())}
              required
              disabled={loading}
              maxLength={20}
            />
            <p className={styles.hint}>
              他のユーザーから検索されるIDです（変更不可）
            </p>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>
              <User size={16} className={styles.labelIcon} />
              <span>ニックネーム</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="表示名"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              disabled={loading}
              maxLength={30}
            />
            <p className={styles.hint}>
              スペースに表示される名前です（後で変更可能）
            </p>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? '設定中...' : '完了'}
          </button>
        </form>
      </div>
    </div>
  );
};
