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

type Props = {
  /** 「投稿する」ボタン専用コールバック。指定時は navigate('post') の代わりに呼ぶ */
  onPostClick?: () => void;
  /** アーカイブ中など投稿導線を無効化 */
  postNavDisabled?: boolean;
};

export const TopRightMenu = ({ onPostClick, postNavDisabled = false }: Props) => {
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
          onClick={() => {
            if (item.screen === 'post' && postNavDisabled) return;
            if (item.screen === 'post' && onPostClick) {
              onPostClick();
              return;
            }
            navigate(item.screen);
          }}
          disabled={item.screen === 'post' && postNavDisabled}
          title={item.screen === 'post' && postNavDisabled ? 'アーカイブ中は投稿できません' : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};
