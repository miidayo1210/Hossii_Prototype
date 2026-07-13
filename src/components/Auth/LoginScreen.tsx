import { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, X, Eye, EyeOff, User } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { AuthEntryShell } from './AuthEntryShell';
import shell from './authEntryShell.module.css';
import styles from './LoginScreen.module.css';

type AuthMode = 'login' | 'signup';

type Props = {
  onClose?: () => void;
  initialMode?: AuthMode;
};

export const LoginScreen = ({ onClose, initialMode = 'login' }: Props) => {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say' | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && !username.trim()) {
      setError('ユーザー名を入力してください');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signUp(
          email,
          password,
          username.trim(),
          birthdate || null,
          gender || null
        );
      }
    } catch (err: unknown) {
      console.error('Authentication error:', err);
      const authErr = err as { code?: string; message?: string };
      setError(getErrorMessage(authErr.code ?? authErr.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code: string): string => {
    switch (code) {
      case 'auth/invalid-email':
        return 'メールアドレスの形式が正しくありません';
      case 'auth/user-disabled':
        return 'このアカウントは無効化されています';
      case 'auth/user-not-found':
        return 'ユーザーが見つかりません';
      case 'auth/wrong-password':
        return 'パスワードが間違っています';
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています';
      case 'auth/weak-password':
        return 'パスワードは6文字以上で設定してください';
      case 'auth/popup-closed-by-user':
        return 'ログインがキャンセルされました';
      default:
        return '認証エラーが発生しました';
    }
  };

  return (
    <AuthEntryShell showAdminLoginLink>
      <div className={`${shell.glassCard} ${shell.cardEnter}`}>
        {/* Close button (only show if onClose is provided) */}
        {onClose && (
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={24} />
          </button>
        )}

        {/* Logo/Title */}
        <div className={styles.header}>
          <h1 className={styles.title}>✨ Hossii</h1>
          <p className={styles.subtitle}>
            {mode === 'login' ? 'おかえりなさい' : 'はじめまして'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => setMode('login')}
            disabled={loading}
          >
            <LogIn size={16} />
            <span>ログイン</span>
          </button>
          <button
            className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
            onClick={() => setMode('signup')}
            disabled={loading}
          >
            <UserPlus size={16} />
            <span>新規登録</span>
          </button>
        </div>

        <div key={mode} className={styles.tabPanel}>
          {/* Error message */}
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {/* Email/Password form */}
          <form onSubmit={handleEmailAuth} className={styles.form}>
          {mode === 'signup' && (
            <div className={styles.inputGroup}>
              <User size={18} className={styles.inputIcon} />
              <input
                type="text"
                className={styles.input}
                placeholder="ユーザー名（必須）"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={30}
                disabled={loading}
              />
            </div>
          )}

          <div className={styles.inputGroup}>
            <Mail size={18} className={styles.inputIcon} />
            <input
              type="email"
              className={styles.input}
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <Lock size={18} className={styles.inputIcon} />
            <input
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              placeholder="パスワード（6文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {mode === 'signup' && (
            <>
              <div className={styles.inputGroup}>
                <input
                  type="date"
                  className={`${styles.input} ${styles.inputNoIcon}`}
                  placeholder="生年月日（任意）"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className={styles.inputGroup}>
                <select
                  className={`${styles.input} ${styles.inputNoIcon} ${styles.selectInput}`}
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                  disabled={loading}
                >
                  <option value="">性別（任意）</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                  <option value="prefer_not_to_say">回答しない</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
          </button>
        </form>
        </div>
      </div>
    </AuthEntryShell>
  );
};
