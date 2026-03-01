import { useState } from 'react';
import { Mail, Lock, Building2 } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import type { AppUser } from '../../core/contexts/AuthContext';
import styles from './LoginScreen.module.css';
import adminStyles from './AdminLoginScreen.module.css';

type Tab = 'login' | 'register';
type ViewState = 'form' | 'pending' | 'rejected';

type Props = {
  onLoginSuccess: () => void;
};

export const AdminLoginScreen = ({ onLoginSuccess }: Props) => {
  const { adminLogin, adminSignUp, loginWithGoogle, logout } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [viewState, setViewState] = useState<ViewState>('form');
  const [pendingCommunityName, setPendingCommunityName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setCommunityName('');
    setError(null);
  };

  const handleTabChange = (next: Tab) => {
    setTab(next);
    resetForm();
  };

  const handleUserCheck = async (user: AppUser) => {
    if (user.isAdmin) {
      onLoginSuccess();
    } else if (user.communityStatus === 'pending') {
      setPendingCommunityName(user.communityName ?? '');
      setViewState('pending');
    } else if (user.communityStatus === 'rejected') {
      setViewState('rejected');
      await logout();
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
      await handleUserCheck(user);
    } catch (err: unknown) {
      console.error('Admin login error:', err);
      setError('ログインに失敗しました。メールアドレスとパスワードをご確認ください。');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await adminSignUp(email, password, communityName);
      await handleUserCheck(user);
    } catch (err: unknown) {
      console.error('Admin sign up error:', err);
      setError('登録に失敗しました。入力内容をご確認ください。');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);

    try {
      const user = await loginWithGoogle(true);
      await handleUserCheck(user);
    } catch (err: unknown) {
      console.error('Google auth error:', err);
      setError('Googleログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // 審査中画面
  if (viewState === 'pending') {
    return (
      <div className={styles.container}>
        <div className={styles.stars}></div>
        <div className={styles.stars2}></div>
        <div className={styles.stars3}></div>
        <div className={`${styles.card} ${adminStyles.pendingCard}`}>
          <div className={adminStyles.pendingIcon}>⏳</div>
          <h1 className={styles.title}>✨ Hossii</h1>
          <h2 className={adminStyles.pendingTitle}>申請を受け付けました</h2>
          {pendingCommunityName && (
            <p className={adminStyles.pendingCommunity}>「{pendingCommunityName}」</p>
          )}
          <p className={adminStyles.pendingMessage}>
            Hossii 運営チームが内容を確認しています。<br />
            審査完了後にメールでご連絡します。<br />
            承認されるとログインできるようになります。
          </p>
          <button
            type="button"
            className={adminStyles.pendingBackButton}
            onClick={async () => {
              await logout();
              setViewState('form');
              setTab('login');
              resetForm();
            }}
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // 却下画面
  if (viewState === 'rejected') {
    return (
      <div className={styles.container}>
        <div className={styles.stars}></div>
        <div className={styles.stars2}></div>
        <div className={styles.stars3}></div>
        <div className={`${styles.card} ${adminStyles.pendingCard}`}>
          <div className={adminStyles.pendingIcon}>❌</div>
          <h1 className={styles.title}>✨ Hossii</h1>
          <h2 className={adminStyles.pendingTitle}>申請が承認されませんでした</h2>
          <p className={adminStyles.pendingMessage}>
            ご不明な点はお問い合わせください。
          </p>
          <button
            type="button"
            className={adminStyles.pendingBackButton}
            onClick={() => {
              setViewState('form');
              setTab('login');
              resetForm();
            }}
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.stars}></div>
      <div className={styles.stars2}></div>
      <div className={styles.stars3}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>✨ Hossii</h1>
          <p className={styles.subtitle}>
            {tab === 'login' ? '管理者ログイン' : 'コミュニティを登録申請'}
          </p>
        </div>

        {/* タブ切り替え */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('login')}
            disabled={loading}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('register')}
            disabled={loading}
          >
            コミュニティを登録申請
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Google ボタン（ログインタブのみ） */}
        {tab === 'login' && (
          <>
            <div className={styles.socialButtons}>
              <button
                className={`${styles.socialButton} ${styles.googleButton}`}
                onClick={handleGoogleAuth}
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
          </>
        )}

        {/* ログインフォーム */}
        {tab === 'login' && (
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
        )}

        {/* コミュニティ登録申請フォーム */}
        {tab === 'register' && (
          <>
            <p className={adminStyles.registerNote}>
              登録申請後、Hossii 運営チームが審査します。<br />
              承認後にスペース管理画面が利用できます。
            </p>
            <form onSubmit={handleEmailRegister} className={styles.form}>
              <div className={styles.inputGroup}>
                <Building2 size={18} className={styles.inputIcon} />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="コミュニティ名"
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

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
                  placeholder="パスワード（8文字以上）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading || !communityName.trim()}
              >
                {loading ? '処理中...' : '登録申請する'}
              </button>
            </form>
          </>
        )}

        <p className={adminStyles.notice}>
          ※ このページは管理者専用です
        </p>
      </div>
    </div>
  );
};
