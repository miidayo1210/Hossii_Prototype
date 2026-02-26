import { useState, useEffect } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { loadSpaceSettings } from '../../core/utils/settingsStorage';
import styles from './TopBar.module.css';

export const TopBar = () => {
  const { state } = useHossiiStore();

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);
  const [spaceName, setSpaceName] = useState(activeSpace?.name || 'Hossii');

  useEffect(() => {
    if (activeSpace) {
      const settings = loadSpaceSettings(activeSpace.id, activeSpace.name);
      setSpaceName(settings.spaceName);
    }
  }, [activeSpace]);

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

  return (
    <header className={styles.topBar}>
      <div className={styles.spaceName}>{spaceName}</div>
    </header>
  );
};
