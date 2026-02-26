import { useState } from 'react';
import { LogOut, User, Mail } from 'lucide-react';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { useAuth } from '../../core/contexts/AuthContext';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import styles from './AccountScreen.module.css';

export const AccountScreen = () => {
  const { currentUser, logout } = useAuth();
  const { state, setDefaultNickname, setSpaceNickname, getActiveSpace } = useHossiiStore();
  const { profile, spaceNicknames, activeSpaceId } = state;
  const activeSpace = getActiveSpace();

  const [defaultNicknameInput, setDefaultNicknameInput] = useState(
    profile?.defaultNickname || ''
  );
  const [spaceNicknameInput, setSpaceNicknameInput] = useState(
    spaceNicknames[activeSpaceId] || ''
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
    setSavedSpace(true);
    setTimeout(() => setSavedSpace(false), 2000);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    const confirmed = window.confirm('ログアウトしてもよろしいですか？');
    if (!confirmed) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      alert('ログアウトに失敗しました');
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={styles.container}>
      <TopRightMenu />

      <header className={styles.header}>
        <h1 className={styles.title}>アカウント</h1>
      </header>

      <main className={styles.content}>

        {/* アカウント情報 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>アカウント情報</h2>

          {currentUser ? (
            <>
              <div className={styles.userInfo}>
                <div className={styles.userAvatar}>
                  <User size={28} />
                </div>
                <div className={styles.userDetails}>
                  <div className={styles.userName}>
                    {profile?.defaultNickname || 'ニックネーム未設定'}
                  </div>
                  <div className={styles.userMeta}>
                    <Mail size={13} />
                    <span>{currentUser.email}</span>
                  </div>
                </div>
              </div>
              <button
                className={styles.logoutButton}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut size={16} />
                <span>{isLoggingOut ? 'ログアウト中...' : 'ログアウト'}</span>
              </button>
            </>
          ) : (
            <div className={styles.guestInfo}>
              <div className={styles.guestLabel}>ゲストとして参加中</div>
              <p className={styles.guestDesc}>
                アカウントを作成すると、複数の端末で同じ情報を使えます。
              </p>
            </div>
          )}
        </section>

        {/* このスペースでのニックネーム */}
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

        {/* デフォルトニックネーム */}
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

      </main>
    </div>
  );
};
