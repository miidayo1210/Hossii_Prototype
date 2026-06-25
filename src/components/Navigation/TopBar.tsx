import { useState, useEffect } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
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

  void focusCount;
  const spaceName = activeSpace?.name ?? 'Hossii';

  return (
    <header className={styles.topBar}>
      <div className={styles.spaceName}>{spaceName}</div>
    </header>
  );
};
