import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type AdminNavigationState = {
  overrideCommunityId: string | null;
  overrideCommunityName: string | null;
  overrideCommunitySlug: string | null;
  setOverrideCommunity: (id: string, name: string, slug?: string | null) => void;
  clearOverrideCommunity: () => void;
};

const AdminNavigationContext = createContext<AdminNavigationState | undefined>(undefined);

export const useAdminNavigation = () => {
  const context = useContext(AdminNavigationContext);
  if (!context) {
    throw new Error('useAdminNavigation must be used within an AdminNavigationProvider');
  }
  return context;
};

type Props = { children: ReactNode };

export const AdminNavigationProvider = ({ children }: Props) => {
  const [overrideCommunityId, setOverrideCommunityId] = useState<string | null>(null);
  const [overrideCommunityName, setOverrideCommunityName] = useState<string | null>(null);
  const [overrideCommunitySlug, setOverrideCommunitySlug] = useState<string | null>(null);

  const setOverrideCommunity = (id: string, name: string, slug?: string | null) => {
    setOverrideCommunityId(id);
    setOverrideCommunityName(name);
    setOverrideCommunitySlug(slug ?? null);
  };

  const clearOverrideCommunity = () => {
    setOverrideCommunityId(null);
    setOverrideCommunityName(null);
    setOverrideCommunitySlug(null);
  };

  return (
    <AdminNavigationContext.Provider
      value={{ overrideCommunityId, overrideCommunityName, overrideCommunitySlug, setOverrideCommunity, clearOverrideCommunity }}
    >
      {children}
    </AdminNavigationContext.Provider>
  );
};
