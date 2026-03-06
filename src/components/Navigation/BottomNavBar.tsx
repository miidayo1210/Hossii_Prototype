import { House, PlusCircle, ScrollText, User, LayoutGrid } from 'lucide-react';
import { useRouter } from '../../core/hooks/useRouter';
import { useAuth } from '../../core/contexts/AuthContext';
import type { Screen } from '../../core/types';
import styles from './BottomNavBar.module.css';

type NavItem = {
  label: string;
  screen: Screen;
  icon: React.ComponentType<{ size?: number }>;
};

const USER_NAV: NavItem[] = [
  { label: 'ホーム', screen: 'screen', icon: House },
  { label: '投稿', screen: 'post', icon: PlusCircle },
  { label: 'ログ', screen: 'comments', icon: ScrollText },
  { label: 'アカウント', screen: 'account', icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'スペース管理', screen: 'spaces', icon: LayoutGrid },
  { label: 'アカウント', screen: 'account', icon: User },
];

export const BottomNavBar = () => {
  const { screen: currentScreen, navigate } = useRouter();
  const { currentUser } = useAuth();

  const navItems = currentUser?.isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <nav className={styles.nav}>
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentScreen === item.screen;

        return (
          <button
            key={item.screen}
            className={`${styles.navButton} ${isActive ? styles.active : ''}`}
            onClick={() => navigate(item.screen)}
            aria-label={item.label}
          >
            <Icon size={24} />
            <span className={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
