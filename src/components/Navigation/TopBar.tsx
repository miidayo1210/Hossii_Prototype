import { useState, useEffect, useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { loadSpaceSettings } from '../../core/utils/settingsStorage';
import styles from './TopBar.module.css';

export const TopBar = () => {
  const { state } = useHossiiStore();

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);

  const [focusCount, setFocusCount] = useState(0);

  useEffect(() => {
    const handleFocus = () => setFocusCount((c) => c + 1);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const spaceName = useMemo(() => {
    void focusCount;
    if (!activeSpace) return 'Hossii';
    return loadSpaceSettings(activeSpace.id, activeSpace.name).spaceName;
  }, [activeSpace, focusCount]);

  return (
    <header className={styles.topBar}>
      <div className={styles.spaceName}>{spaceName}</div>
    </header>
  );
};
