import { useState, useEffect } from 'react';
import { LogOut, User, Mail } from 'lucide-react';
import { ProfileScreen } from '../ProfileScreen/ProfileScreen';
import { SpacesScreen } from '../SpacesScreen/SpacesScreen';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { useAuth } from '../../core/contexts/AuthContext';
import styles from './AccountScreen.module.css';

type Tab = 'profile' | 'spaces';

export const AccountScreen = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [userProfile, setUserProfile] = useState<{ userId: string; nickname: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Load user profile from localStorage
  useEffect(() => {
    if (currentUser) {
      const savedProfile = localStorage.getItem(`profile_${currentUser.uid}`);
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      }
    }
  }, [currentUser]);

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

        {/* User info section */}
        {userProfile && currentUser && (
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              <User size={32} />
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{userProfile.nickname}</div>
              <div className={styles.userId}>
                <Mail size={14} />
                <span>{currentUser.email}</span>
              </div>
              <div className={styles.userId}>
                <span>@{userProfile.userId}</span>
              </div>
            </div>
          </div>
        )}

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'profile' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            プロフィール
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'spaces' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('spaces')}
          >
            スペース管理
          </button>
        </div>
      </header>

      <main className={styles.content}>
        {activeTab === 'profile' ? <ProfileScreen /> : <SpacesScreen />}
      </main>

      {/* Logout button */}
      <div className={styles.logoutSection}>
        <button
          className={styles.logoutButton}
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={20} />
          <span>{isLoggingOut ? 'ログアウト中...' : 'ログアウト'}</span>
        </button>
      </div>
    </div>
  );
};
