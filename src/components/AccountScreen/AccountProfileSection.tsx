import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { nicknameInputAntiAutofillProps } from '../../core/utils/nicknameInputProps';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { ACCOUNT_AUTH_COMING_SOON } from '../../core/config/features';
import { useRouter } from '../../core/hooks/useRouter';
import type { AccountIdentity } from '../../core/utils/resolveAccountIdentity';
import { HossiiAboutSection } from './HossiiAboutSection';
import styles from './AccountScreen.module.css';

type Props = {
  identity: AccountIdentity;
  onLoginRequested?: () => void;
  onSignUpRequested?: () => void;
  onSpaceNicknameSaved?: () => void;
};

export const AccountProfileSection = ({
  identity,
  onLoginRequested,
  onSignUpRequested,
  onSpaceNicknameSaved,
}: Props) => {
  const { currentUser, logout } = useAuth();
  const { navigate } = useRouter();
  const { state, setDefaultNickname, setSpaceNickname, getActiveSpace } = useHossiiStore();
  const { profile, spaceNicknames, activeSpaceId } = state;
  const activeSpace = getActiveSpace();

  const [defaultNicknameInput, setDefaultNicknameInput] = useState(
    profile?.defaultNickname || '',
  );
  const [spaceNicknameInput, setSpaceNicknameInput] = useState(
    spaceNicknames[activeSpaceId] || '',
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [savedDefault, setSavedDefault] = useState(false);
  const [savedSpace, setSavedSpace] = useState(false);

  const handleSaveDefaultNickname = () => {
    const trimmed = defaultNicknameInput.trim();
    if (!trimmed) return;
    setDefaultNickname(trimmed);
    setSavedDefault(true);
    setTimeout(() => setSavedDefault(false), 2000);
  };

  const handleSaveSpaceNickname = () => {
    const trimmed = spaceNicknameInput.trim();
    if (!trimmed) return;
    setSpaceNickname(activeSpaceId, trimmed);
    onSpaceNicknameSaved?.();
    setSavedSpace(true);
    setTimeout(() => setSavedSpace(false), 2000);
  };

  const guestSignUpLocked = !currentUser && ACCOUNT_AUTH_COMING_SOON;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    const confirmed = window.confirm('ログアウトしてもよろしいですか？');
    if (!confirmed) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('screen');
    } catch (error) {
      console.error('Logout error:', error);
      alert('ログアウトに失敗しました');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div data-testid="account-section-profile" className={styles.sectionStack}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アカウント情報</h2>

        {currentUser ? (
          <>
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                <User size={28} />
              </div>
              <div className={styles.userDetails}>
                <div className={styles.userName}>{identity.displayName}</div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.guestInfo}>
            <div className={styles.guestLabel}>ゲストとして参加中</div>
            <p className={styles.guestDesc}>
              アカウントを作成すると、複数の端末で同じ情報を使えます。
            </p>
            {guestSignUpLocked && (
              <p className={styles.comingSoonHint} role="status">
                新規会員登録は Coming soon です。管理者から発行された参加 ID がある場合はログインできます。
              </p>
            )}
            <div className={styles.guestActions}>
              <button
                type="button"
                className={styles.loginButton}
                onClick={onLoginRequested}
              >
                アカウントでログイン
              </button>
              <button
                type="button"
                className={`${styles.signUpButton} ${guestSignUpLocked ? styles.guestAuthLocked : ''}`}
                disabled={guestSignUpLocked}
                onClick={onSignUpRequested}
              >
                新規会員登録
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>このスペースでのニックネーム</h2>
        {activeSpace && (
          <p className={styles.sectionDesc}>スペース: {activeSpace.name}</p>
        )}
        <p className={styles.sectionDesc}>
          未設定の場合はデフォルトニックネームが使われます。
        </p>
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.input}
            placeholder={profile?.defaultNickname || 'ニックネームを入力'}
            value={spaceNicknameInput}
            onChange={(e) => setSpaceNicknameInput(e.target.value)}
            {...nicknameInputAntiAutofillProps}
          />
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSaveSpaceNickname}
            disabled={!spaceNicknameInput.trim()}
          >
            {savedSpace ? '保存済み ✓' : '保存'}
          </button>
        </div>
        {spaceNicknames[activeSpaceId] && (
          <p className={styles.currentValue}>現在の設定: {spaceNicknames[activeSpaceId]}</p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>デフォルトニックネーム</h2>
        <p className={styles.sectionDesc}>
          全スペース共通の表示名です。スペース別ニックネームが優先されます。
        </p>
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="ニックネームを入力"
            value={defaultNicknameInput}
            onChange={(e) => setDefaultNicknameInput(e.target.value)}
            {...nicknameInputAntiAutofillProps}
          />
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSaveDefaultNickname}
            disabled={!defaultNicknameInput.trim()}
          >
            {savedDefault ? '保存済み ✓' : '保存'}
          </button>
        </div>
        {profile?.defaultNickname && (
          <p className={styles.currentValue}>現在の設定: {profile.defaultNickname}</p>
        )}
      </section>

      <HossiiAboutSection />

      {currentUser ? (
        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={16} />
          <span>{isLoggingOut ? 'ログアウト中...' : 'ログアウト'}</span>
        </button>
      ) : null}
    </div>
  );
};
