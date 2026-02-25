import { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import styles from './LoginScreen.module.css';
import adminStyles from './AdminLoginScreen.module.css';

type Props = {
  onLoginSuccess: () => void;
};

export const AdminLoginScreen = ({ onLoginSuccess }: Props) => {
  const { adminLogin, loginWithGoogle, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminCheck = async (isAdmin: boolean) => {
    if (isAdmin) {
      onLoginSuccess();
    } else {
      setError('このアカウントには管理者権限がありません。');
      await logout();
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await adminLogin(email, password);
      await handleAdminCheck(user.isAdmin);
    } catch (err: unknown) {
      console.error('Admin login error:', err);
      setError('ログインに失敗しました。メールアドレスとパスワードをご確認ください。');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const user = await loginWithGoogle(true);
      await handleAdminCheck(user.isAdmin);
    } catch (err: unknown) {
      console.error('Google login error:', err);
      setError('Googleログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.stars}></div>
      <div className={styles.stars2}></div>
      <div className={styles.stars3}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>✨ Hossii</h1>
          <p className={styles.subtitle}>管理者ログイン</p>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Google login */}
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
        </div>

        <div className={styles.divider}>
          <span className={styles.dividerText}>または</span>
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleEmailLogin} className={styles.form}>
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
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>

        <p className={adminStyles.notice}>
          ※ このページは管理者専用です
        </p>
      </div>
    </div>
  );
};
