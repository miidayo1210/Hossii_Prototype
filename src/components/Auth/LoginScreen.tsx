import { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import styles from './LoginScreen.module.css';

type AuthMode = 'login' | 'signup';

type Props = {
  onClose?: () => void;
};

export const LoginScreen = ({ onClose }: Props) => {
  const { login, signUp, loginWithGoogle, loginWithFacebook } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      await loginWithFacebook();
    } catch (err: any) {
      console.error('Facebook login error:', err);
      setError(getErrorMessage(err.code));
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
    <div className={styles.container}>
      {/* Background stars */}
      <div className={styles.stars}></div>
      <div className={styles.stars2}></div>
      <div className={styles.stars3}></div>

      <div className={styles.card}>
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

        {/* Error message */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Email/Password form */}
        <form onSubmit={handleEmailAuth} className={styles.form}>
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
              type="password"
              className={styles.input}
              placeholder="パスワード（6文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : '新規登録'}
          </button>
        </form>

        {/* Divider */}
        <div className={styles.divider}>
          <span className={styles.dividerText}>または</span>
        </div>

        {/* Social login buttons */}
        <div className={styles.socialButtons}>
          <button
            className={`${styles.socialButton} ${styles.googleButton}`}
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className={styles.socialIcon} viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Googleでログイン</span>
          </button>

          <button
            className={`${styles.socialButton} ${styles.facebookButton}`}
            onClick={handleFacebookLogin}
            disabled={loading}
          >
            <svg className={styles.socialIcon} viewBox="0 0 24 24">
              <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>Facebookでログイン</span>
          </button>
        </div>
      </div>
    </div>
  );
};
