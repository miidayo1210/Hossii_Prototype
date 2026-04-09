import { useState } from 'react';
import { Mail, Lock, Building2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import type { AppUser } from '../../core/contexts/AuthContext';
import { AuthEntryShell } from './AuthEntryShell';
import shell from './authEntryShell.module.css';
import styles from './LoginScreen.module.css';
import adminStyles from './AdminLoginScreen.module.css';

type Tab = 'login' | 'register';
type ViewState = 'form' | 'pending' | 'rejected';

type Props = {
  onLoginSuccess: (user: AppUser) => void;
};

export const AdminLoginScreen = ({ onLoginSuccess }: Props) => {
  const { adminLogin, adminSignUp, logout } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [viewState, setViewState] = useState<ViewState>('form');
  const [pendingCommunityName, setPendingCommunityName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      onLoginSuccess(user);
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

  // 審査中画面
  if (viewState === 'pending') {
    return (
      <AuthEntryShell>
        <div className={`${shell.glassCard} ${shell.cardEnter} ${adminStyles.pendingCard}`}>
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
      </AuthEntryShell>
    );
  }

  // 却下画面
  if (viewState === 'rejected') {
    return (
      <AuthEntryShell>
        <div className={`${shell.glassCard} ${shell.cardEnter} ${adminStyles.pendingCard}`}>
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
      </AuthEntryShell>
    );
  }

  return (
    <AuthEntryShell>
      <div className={`${shell.glassCard} ${shell.cardEnter} ${adminStyles.adminFormCard}`}>
        <div className={`${styles.header} ${adminStyles.adminCompactHeader}`}>
          <h1 className={styles.title}>✨ Hossii</h1>
          <p className={styles.subtitle}>
            {tab === 'login' ? '管理者ログイン' : 'コミュニティを登録申請'}
          </p>
        </div>

        {/* タブ切り替え */}
        <div className={`${styles.tabs} ${adminStyles.adminCompactTabs}`}>
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

        <div key={tab} className={styles.tabPanel}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {tab === 'login' && (
            <>
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
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder="パスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? '処理中...' : 'ログイン'}
                </button>
              </form>
            </>
          )}

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
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder="パスワード（8文字以上）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={8}
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
        </div>
      </div>
    </AuthEntryShell>
  );
};
