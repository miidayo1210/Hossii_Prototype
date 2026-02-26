import { useRouter } from '../../core/hooks/useRouter';
import type { Screen } from '../../core/types';
import styles from './TopRightMenu.module.css';

type NavItem = {
  label: string;
  screen: Screen;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'スペース', screen: 'screen' },
  { label: '投稿する', screen: 'post' },
  { label: 'ログ一覧', screen: 'comments' },
  { label: 'アカウント', screen: 'account' },
];

export const TopRightMenu = () => {
  const { screen: currentScreen, navigate } = useRouter();

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.screen}
          type="button"
          className={`${styles.navButton} ${
            currentScreen === item.screen ? styles.navButtonActive : ''
          }`}
          onClick={() => navigate(item.screen)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};
