import { useAuth } from '../../core/contexts/useAuth';
import { useHasPublishedChallengePrograms } from '../../core/hooks/useHasPublishedChallengePrograms';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useRouter } from '../../core/hooks/useRouter';
import type { Screen } from '../../core/types';
import styles from './TopRightMenu.module.css';

type NavItem = {
  label: string;
  screen: Screen;
};

const BASE_NAV: NavItem[] = [
  { label: 'スペース', screen: 'screen' },
  { label: '投稿する', screen: 'post' },
  { label: 'ログ一覧', screen: 'comments' },
  { label: 'アカウント', screen: 'account' },
];

const CHALLENGE_NAV: NavItem = { label: '挑戦状', screen: 'challenge' };

type Props = {
  /** 「投稿する」ボタン専用コールバック。指定時は navigate('post') の代わりに呼ぶ */
  onPostClick?: () => void;
  /** アーカイブ中など投稿導線を無効化 */
  postNavDisabled?: boolean;
};

export const TopRightMenu = ({ onPostClick, postNavDisabled = false }: Props) => {
  const { screen: currentScreen, navigate } = useRouter();
  const { currentUser } = useAuth();
  const { state } = useHossiiStore();
  // MVP暫定: スペース全体ON/OFF未実装のため、SELECT可能な published program があるときだけ表示。
  const showChallenge = useHasPublishedChallengePrograms(
    state.activeSpaceId,
    Boolean(currentUser?.uid),
  );

  const navItems = showChallenge
    ? [
        BASE_NAV[0],
        BASE_NAV[1],
        BASE_NAV[2],
        CHALLENGE_NAV,
        BASE_NAV[3],
      ]
    : BASE_NAV;

  return (
    <nav className={styles.nav}>
      {navItems.map((item) => (
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
