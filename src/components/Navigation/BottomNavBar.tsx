import { House, PlusCircle, ScrollText, User } from 'lucide-react';
import { useRouter } from '../../core/hooks/useRouter';
import type { Screen } from '../../core/types';
import styles from './BottomNavBar.module.css';

type NavItem = {
  label: string;
  screen: Screen;
  icon: React.ComponentType<{ size?: number }>;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'ホーム', screen: 'screen', icon: House },
  { label: '投稿', screen: 'post', icon: PlusCircle },
  { label: 'ログ', screen: 'comments', icon: ScrollText },
  { label: 'アカウント', screen: 'account', icon: User },
];

export const BottomNavBar = () => {
  const { screen: currentScreen, navigate } = useRouter();

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(item => {
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
