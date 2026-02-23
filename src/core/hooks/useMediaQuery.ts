import { useState, useEffect } from 'react';

/**
 * useMediaQuery - Reusable hook for responsive behavior
 * @param query - Media query string (e.g., "(max-width: 768px)")
 * @returns boolean - Whether the media query matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() =>
    window.matchMedia(query).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
};
