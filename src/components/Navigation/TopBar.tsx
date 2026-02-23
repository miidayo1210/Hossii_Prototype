import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from '../../core/hooks/useRouter';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { loadSpaceSettings } from '../../core/utils/settingsStorage';
import styles from './TopBar.module.css';

export const TopBar = () => {
  const { navigate } = useRouter();
  const { state } = useHossiiStore();

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);
  const [spaceName, setSpaceName] = useState(activeSpace?.name || 'Hossii Demo Space');

  // 設定からスペース名を読み込む
  useEffect(() => {
    if (activeSpace) {
      const settings = loadSpaceSettings(activeSpace.id, activeSpace.name);
      setSpaceName(settings.spaceName);
    }
  }, [activeSpace]);

  // フォーカス時に設定を再読み込み
  useEffect(() => {
    const handleFocus = () => {
      if (activeSpace) {
        const settings = loadSpaceSettings(activeSpace.id, activeSpace.name);
        setSpaceName(settings.spaceName);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeSpace]);

  const handleAddSpace = () => {
    navigate('spaces');
  };

  return (
    <header className={styles.topBar}>
      <div className={styles.spaceName}>{spaceName}</div>

      <nav className={styles.nav}>
        <button
          className={styles.navLink}
          onClick={() => navigate('card')}
        >
          スタンプカード
        </button>
        <button
          className={styles.navLink}
          onClick={() => navigate('account')}
        >
          アカウント
        </button>

        <button
          className={styles.addButton}
          onClick={handleAddSpace}
          aria-label="スペースを追加"
        >
          <Plus size={20} />
          <span>スペース追加</span>
        </button>
      </nav>
    </header>
  );
};
