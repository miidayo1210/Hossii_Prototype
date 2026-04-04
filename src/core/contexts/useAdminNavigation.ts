import { createContext, useContext } from 'react';
import type { AdminNavigationState } from './AdminNavigationContext';

export const AdminNavigationContext = createContext<AdminNavigationState | undefined>(undefined);

export const useAdminNavigation = () => {
  const context = useContext(AdminNavigationContext);
  if (!context) {
    throw new Error('useAdminNavigation must be used within an AdminNavigationProvider');
  }
  return context;
};
