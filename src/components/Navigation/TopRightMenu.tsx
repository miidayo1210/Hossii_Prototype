import { useState, useRef, useEffect } from 'react';
import { useRouter } from '../../core/hooks/useRouter';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { Screen } from '../../core/types';
import styles from './TopRightMenu.module.css';

type NavItem = {
  label: string;
  screen: Screen;
};

// Primary ナビ（常時表示）
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: 'ログを置く', screen: 'post' },
  { label: 'ログ一覧', screen: 'comments' },
];

// Secondary ナビ（ドロップダウン）
const SECONDARY_NAV_ITEMS: NavItem[] = [
  { label: 'アカウント情報', screen: 'account' },
  { label: 'スペース管理', screen: 'settings' },
  { label: 'スタンプカード', screen: 'card' },
  { label: 'スペース一覧', screen: 'spaces' },
  { label: 'マイログ', screen: 'mylogs' },
  { label: 'プロフィール', screen: 'profile' },
];

export const TopRightMenu = () => {
  const { screen: currentScreen, navigate } = useRouter();
  const { state } = useHossiiStore();
  const { mode } = state;

  // ドロップダウン表示
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Secondary ナビでアクティブなものがあるかどうか
  const isSecondaryActive = SECONDARY_NAV_ITEMS.some((item) => currentScreen === item.screen);

  return (
    <nav className={styles.nav}>
      {/* Primary ナビ */}
      {PRIMARY_NAV_ITEMS.map((item) => (
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

      {/* Secondary ナビ（personalモードのみ） */}
      {mode === 'personal' && (
        <div className={styles.dropdownContainer} ref={dropdownRef}>
          <button
            type="button"
            className={`${styles.navButton} ${styles.moreButton} ${
              isSecondaryActive ? styles.navButtonActive : ''
            }`}
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="その他のメニュー"
          >
            ⋯
          </button>
          {showDropdown && (
            <div className={styles.dropdown}>
              {SECONDARY_NAV_ITEMS.map((item) => (
                <button
                  key={item.screen}
                  type="button"
                  className={`${styles.dropdownItem} ${
                    currentScreen === item.screen ? styles.dropdownItemActive : ''
                  }`}
                  onClick={() => {
                    navigate(item.screen);
                    setShowDropdown(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
