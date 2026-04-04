import { createContext, useContext } from 'react';
import type { HossiiContextValue } from './HossiiStoreProvider';

export const HossiiContext = createContext<HossiiContextValue | null>(null);

export const useHossiiStore = () => {
  const context = useContext(HossiiContext);
  if (!context) {
    throw new Error('useHossiiStore must be used within a HossiiProvider');
  }
  return context;
};
