import { useState } from 'react';
import type { ReactNode } from 'react';
import { AdminNavigationContext } from './useAdminNavigation';

export type AdminNavigationState = {
  overrideCommunityId: string | null;
  overrideCommunityName: string | null;
  overrideCommunitySlug: string | null;
  setOverrideCommunity: (id: string, name: string, slug?: string | null) => void;
  clearOverrideCommunity: () => void;
};

type Props = { children: ReactNode };

const SESSION_KEY = 'hossii_adminNav';

type PersistedAdminNav = {
  id: string | null;
  name: string | null;
  slug: string | null;
};

const loadFromSession = (): PersistedAdminNav => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : { id: null, name: null, slug: null };
  } catch {
    return { id: null, name: null, slug: null };
  }
};

const saveToSession = (data: PersistedAdminNav) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage が使えない環境ではスキップ
  }
};

const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
};

export const AdminNavigationProvider = ({ children }: Props) => {
  const [overrideCommunityId, setOverrideCommunityId] = useState<string | null>(() => loadFromSession().id);
  const [overrideCommunityName, setOverrideCommunityName] = useState<string | null>(() => loadFromSession().name);
  const [overrideCommunitySlug, setOverrideCommunitySlug] = useState<string | null>(() => loadFromSession().slug);

  const setOverrideCommunity = (id: string, name: string, slug?: string | null) => {
    setOverrideCommunityId(id);
    setOverrideCommunityName(name);
    setOverrideCommunitySlug(slug ?? null);
    saveToSession({ id, name, slug: slug ?? null });
  };

  const clearOverrideCommunity = () => {
    setOverrideCommunityId(null);
    setOverrideCommunityName(null);
    setOverrideCommunitySlug(null);
    clearSession();
  };

  return (
    <AdminNavigationContext.Provider
      value={{ overrideCommunityId, overrideCommunityName, overrideCommunitySlug, setOverrideCommunity, clearOverrideCommunity }}
    >
      {children}
    </AdminNavigationContext.Provider>
  );
};
