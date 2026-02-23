import { useState, useEffect } from 'react';
import { useAuth } from '../../core/contexts/AuthContext';
import { getStampCount, getCurrentCardProgress, getCompletedCardCount, getStampCardTheme, saveStampCardTheme } from '../../core/utils/stampStorage';
import type { StampCardTheme } from '../../core/types/stamp';
import { STAMPS_PER_CARD } from '../../core/types/stamp';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { StampCard } from './StampCard';
import styles from './StampCardScreen.module.css';

const THEME_OPTIONS: Array<{ value: StampCardTheme; label: string; description: string }> = [
  { value: 'grid', label: 'ベーシック', description: 'シンプルな格子状の配置' },
  { value: 'spiral', label: 'スパイラル', description: '中心に向かって渦を巻く配置' },
  { value: 'wave', label: 'ウェイブ', description: '波打つような配置' },
  { value: 'starry', label: 'ランダム', description: '星空のように散らばった配置' },
  { value: 'circle', label: 'サークル', description: '大きな円を描く配置' },
];

export const StampCardScreen = () => {
  const { currentUser } = useAuth();
  const [totalStamps, setTotalStamps] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [completedCards, setCompletedCards] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<StampCardTheme>('grid');

  useEffect(() => {
    if (currentUser) {
      const total = getStampCount(currentUser.uid);
      const progress = getCurrentCardProgress(currentUser.uid);
      const completed = getCompletedCardCount(currentUser.uid);
      const theme = getStampCardTheme();

      setTotalStamps(total);
      setCurrentProgress(progress);
      setCompletedCards(completed);
      setSelectedTheme(theme);
    }
  }, [currentUser]);

  const handleThemeChange = (theme: StampCardTheme) => {
    setSelectedTheme(theme);
    saveStampCardTheme(theme);
  };

  return (
    <div className={styles.container}>
      <TopRightMenu />

      <header className={styles.header}>
        <h1 className={styles.title}>スタンプカード ⭐</h1>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>合計</span>
            <span className={styles.statValue}>{totalStamps}個</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>完成したカード</span>
            <span className={styles.statValue}>{completedCards}枚</span>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <main className={styles.cardArea}>
          <div className={styles.cardContainer}>
            <h2 className={styles.cardTitle}>
              現在のカード ({currentProgress}/{STAMPS_PER_CARD})
            </h2>
            <StampCard progress={currentProgress} theme={selectedTheme} />
          </div>
        </main>

        <aside className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>カードのデザイン</h3>
          <div className={styles.themeList}>
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`${styles.themeButton} ${
                  selectedTheme === option.value ? styles.themeButtonSelected : ''
                }`}
                onClick={() => handleThemeChange(option.value)}
              >
                <div className={styles.themeIcon}>
                  {getThemeIcon(option.value)}
                </div>
                <div className={styles.themeInfo}>
                  <div className={styles.themeLabel}>{option.label}</div>
                  <div className={styles.themeDescription}>{option.description}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

const getThemeIcon = (theme: StampCardTheme): string => {
  switch (theme) {
    case 'grid':
      return '◻️';
    case 'spiral':
      return '🌀';
    case 'wave':
      return '〰️';
    case 'starry':
      return '✨';
    case 'circle':
      return '⭕';
    default:
      return '◻️';
  }
};
