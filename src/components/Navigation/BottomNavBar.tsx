import { House, PlusCircle, ScrollText, Sparkles, User } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHasPublishedChallengePrograms } from '../../core/hooks/useHasPublishedChallengePrograms';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useRouter } from '../../core/hooks/useRouter';
import type { Screen } from '../../core/types';
import styles from './BottomNavBar.module.css';

type NavItem = {
  label: string;
  screen: Screen;
  icon: React.ComponentType<{ size?: number }>;
};

const BASE_NAV: NavItem[] = [
  { label: 'スペース', screen: 'screen', icon: House },
  { label: '投稿', screen: 'post', icon: PlusCircle },
  { label: 'ログ', screen: 'comments', icon: ScrollText },
  { label: 'アカウント', screen: 'account', icon: User },
];

const CHALLENGE_NAV: NavItem = {
  label: '挑戦状',
  screen: 'challenge',
  icon: Sparkles,
};

type Props = {
  isMobile?: boolean;
  onMobilePostPress?: () => void;
};

export const BottomNavBar = ({ isMobile = false, onMobilePostPress }: Props) => {
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
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive =
          item.screen === 'comments' && currentScreen === 'screen'
            ? false
            : item.screen === 'post' && isMobile
              ? false
              : currentScreen === item.screen;

        return (
          <button
            key={item.screen}
            className={`${styles.navButton} ${isActive ? styles.active : ''}`}
            onClick={() => {
              if (item.screen === 'post' && isMobile && onMobilePostPress) {
                onMobilePostPress();
                return;
              }
              navigate(item.screen);
            }}
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
