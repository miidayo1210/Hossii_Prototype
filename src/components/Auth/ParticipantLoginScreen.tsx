import { useState } from 'react';
import { Lock, LogIn, X, Eye, EyeOff, User } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { AuthEntryShell } from './AuthEntryShell';
import shell from './authEntryShell.module.css';
import styles from './LoginScreen.module.css';

type Props = {
  spaceId: string;
  onClose: () => void;
  /** 「メールアドレスでログイン」導線。押すと既存の LoginScreen（一般ログイン）へ切り替える */
  onEmailLogin?: () => void;
};

export const ParticipantLoginScreen = ({ spaceId, onClose, onEmailLogin }: Props) => {
  const { loginParticipant } = useAuth();
  const { state } = useHossiiStore();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const space = state.spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name ?? 'スペース';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedLoginId = loginId.trim();
    if (!trimmedLoginId || !password) {
      setError('参加 ID とパスワードを入力してください');
      return;
    }

    setLoading(true);
    try {
      await loginParticipant(spaceId, trimmedLoginId, password);
    } catch (err: unknown) {
      console.error('Participant login error:', err);
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Invalid login credentials') || message.includes('正しくありません')) {
        setError('参加 ID またはパスワードが正しくありません');
      } else {
        setError(message || 'ログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthEntryShell>
      <div className={`${shell.glassCard} ${shell.cardEnter} ${styles.card}`}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="閉じる"
        >
          <X size={24} />
        </button>

        <div className={styles.header}>
          <h1 className={styles.title}>✨ Hossii</h1>
          <p className={styles.subtitle}>「{spaceName}」にログイン</p>
        </div>

        <div className={styles.tabPanel}>
          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <User size={18} className={styles.inputIcon} />
              <input
                type="text"
                className={styles.input}
                placeholder="参加 ID"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button type="submit" className={styles.submitButton} disabled={loading}>
              <LogIn size={18} />
              <span>{loading ? 'ログイン中…' : 'ログイン'}</span>
            </button>
          </form>

          {onEmailLogin && (
            <div className={styles.altLoginRow}>
              <button
                type="button"
                className={styles.altLoginLink}
                onClick={onEmailLogin}
                disabled={loading}
              >
                メールアドレスでログインする
              </button>
            </div>
          )}
        </div>
      </div>
    </AuthEntryShell>
  );
};
