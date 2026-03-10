import { useState, useEffect, useCallback } from 'react';
import type { Screen } from '../types';

const VALID_SCREENS: Screen[] = [
  'post', 'screen', 'comments', 'spaces', 'profile',
  'mylogs', 'account', 'settings', 'card', 'communities', 'reflection',
];

type RouterState = {
  screen: Screen;
  screenParam?: string;
};

const parseHash = (hash: string): RouterState => {
  const cleaned = hash.replace('#', '');
  const slashIdx = cleaned.indexOf('/');
  const screenPart = slashIdx >= 0 ? cleaned.slice(0, slashIdx) : cleaned;
  const param = slashIdx >= 0 ? cleaned.slice(slashIdx + 1) : undefined;

  const screen = VALID_SCREENS.includes(screenPart as Screen)
    ? (screenPart as Screen)
    : 'screen';

  return { screen, screenParam: param || undefined };
};

export const useRouter = () => {
  const [routerState, setRouterState] = useState<RouterState>(() =>
    parseHash(window.location.hash)
  );

  useEffect(() => {
    const handleHashChange = () => {
      setRouterState(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((newScreen: Screen, param?: string) => {
    window.location.hash = param ? `${newScreen}/${param}` : newScreen;
  }, []);

  return { screen: routerState.screen, screenParam: routerState.screenParam, navigate };
};
