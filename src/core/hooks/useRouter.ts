import { useState, useEffect, useCallback } from 'react';
import type { Screen } from '../types';

const parseHash = (hash: string): Screen => {
  const cleaned = hash.replace('#', '');
  if (cleaned === 'post' || cleaned === 'screen' || cleaned === 'comments' || cleaned === 'spaces' || cleaned === 'profile' || cleaned === 'mylogs' || cleaned === 'account' || cleaned === 'settings' || cleaned === 'card') {
    return cleaned;
  }
  return 'screen';
};

export const useRouter = () => {
  const [screen, setScreen] = useState<Screen>(() =>
    parseHash(window.location.hash)
  );

  useEffect(() => {
    const handleHashChange = () => {
      setScreen(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((newScreen: Screen) => {
    window.location.hash = newScreen;
  }, []);

  return { screen, navigate };
};
